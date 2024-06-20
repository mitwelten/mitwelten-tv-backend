import { Injectable } from '@angular/core';
import { DataService } from './data.service';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { ReplaySubject, distinctUntilChanged, tap } from 'rxjs';
import { StackImage } from '../shared/stack-image.type';
import { HttpClient } from '@angular/common/http';
import { StackQuery } from '../shared/stack-query.type';


@Injectable({
  providedIn: 'root'
})
/**
 * Service for managing the image stack.
 *
 * The stack is a collection of images that are loaded and displayed in a seamless loop.
 *
 * - Selection criteria are defined in a form and submitted to the stack service
 * - The stack service retrieves the images from the data service
 * - The stack service also returns metadata for the images, like the image size,
 *   actual date range, dimensions, etc.
 *
 */
export class StackService {

  public stack: ReplaySubject<StackImage[]> = new ReplaySubject<StackImage[]>();
  public framerate: ReplaySubject<number> = new ReplaySubject<number>(1);
  public loading: ReplaySubject<boolean> = new ReplaySubject<boolean>();

  selectionCriteria: FormGroup = new FormGroup({
    deployment:    new FormControl<number|null>(null), // deployment id
    period_start:  new FormControl<Date|null>(null),
    period_end:    new FormControl<Date|null>(null),
    interval:      new FormControl<number>(1), // in seconds
    phase:         new FormControl<'day'|'night'|null>(null),
    // phases:        new FormArray([
    //   new FormGroup({
    //     phase_start: new FormControl<number>(0),  // in hours
    //     phase_end:   new FormControl<number>(24), // in hours
    //   }),
    // ]),
    framerate:     new FormControl<number>(1), // in frames per second
  });

  constructor(
    private dataService: DataService,
    private http: HttpClient
  ) {
    this.selectionCriteria.valueChanges.pipe(
      tap(() => {
        this.framerate.next(this.selectionCriteria.value.framerate);
      }),
      distinctUntilChanged((a, b) => {
        const { framerate: framerateA, ...restA } = a;
        const { framerate: framerateB, ...restB } = b;
        return JSON.stringify(restA) === JSON.stringify(restB);
      })
    ).subscribe(() => {
      if (this.selectionCriteria.valid) {
        this.loadStack();
      }
    });
  }

  loadStack(): void {
    const query = this.selectionCriteria.value;
    const translatedQuery: StackQuery = {
      deployment_id: query.deployment,
      period: {
        start: query.period_start?.toISOString(),
        end: query.period_end?.toISOString()
      },
      interval: query.interval,
      phase: query.phase,
    };
    this.loading.next(true);
    this.dataService.getImageStack(translatedQuery).subscribe({
      next: (stack) => {
        this.loading.next(false);
        this.stack.next(stack);
      },
      error: () => {
        this.loading.next(false);
      }});
  }

  loadJsonFile(): void {
    this.http.get('assets/imgstack.json').subscribe((data: any) => {
      // Process the data from the JSON file
      this.stack.next(data);
    });
  }
}
