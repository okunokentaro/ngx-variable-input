import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnInit,
} from '@angular/core';
import {
  fromEvent,
  Observable,
  Subject,
  ConnectableObservable,
  BehaviorSubject,
} from 'rxjs';
import { filter, publishLast, tap, scan, share } from 'rxjs/operators';

interface Model {
  text: string;
  isElement: boolean;
}

interface KeydownAction {
  type: 'keydown';
  payload: KeyboardEvent;
}

interface FinishImeAction {
  type: 'finishIme';
}

interface KeyupAction {
  type: 'keyup';
  payload: {
    event: KeyboardEvent;
    anchorElement: Element;
    anchorOffset: number;
  };
}

interface FinishRenderAction {
  type: 'finishRender';
}

type ActionsUnion =
  | KeydownAction
  | FinishImeAction
  | KeyupAction
  | FinishRenderAction;

interface State {
  isRunningIme: boolean;
  shouldReRender: boolean;
  event: KeyboardEvent | null;
}

const initialState: State = {
  isRunningIme: false,
  shouldReRender: false,
  event: null,
};

function getAnchor(): {
  selectionRef: Selection;
  element: HTMLSpanElement;
  offset: number;
} {
  const selectionRef = window.getSelection() as Selection;
  const { anchorNode, anchorOffset } = selectionRef;
  if (!anchorNode) {
    throw new Error();
  }

  return {
    selectionRef,
    element: anchorNode.parentNode as HTMLSpanElement,
    offset: anchorOffset,
  };
}

@Component({
  selector: 'app-variable-input',
  templateUrl: './component.html',
  styleUrls: ['./component.scss'],
})
export class VariableInputComponent implements OnInit, AfterViewInit {
  @ViewChild('input') inputRef!: ElementRef<HTMLDivElement>;
  model: Model[] = [
    {
      text: `取引先 相手名様 いつもお世話になっております。自社名の氏名です。`,
      isElement: false,
    },
  ];
  store$: Observable<State> = new BehaviorSubject<State>(
    initialState,
  ).asObservable();
  private dispatcher$ = new Subject<ActionsUnion>();

  ngOnInit() {
    this.store$ = this.dispatcher$.pipe(
      scan((state: State, action: ActionsUnion) => {
        switch (action.type) {
          case 'keydown':
            const shouldStartIme = [
              'Tab',
              'ArrowLeft',
              'ArrowDown',
              'ArrowUp',
              'ArrowRight',
              'Shift',
              'Meta',
              'Alt',
              'Control',
              'Backspace',
              'Enter',
              'CapsLock',
            ].every(key => !action.payload.key.includes(key));

            return { ...state, isRunningIme: shouldStartIme };

          case 'finishIme':
            return { ...state, isRunningIme: false };

          case 'keyup':
            // このキー以外のキーはテキストを変更している
            const hasChangedTextContent = ![
              'ArrowLeft',
              'ArrowDown',
              'ArrowUp',
              'ArrowRight',
              'Shift',
              'Meta',
              'Alt',
              'Control',
            ].some(key => action.payload.event.key.includes(key));

            return {
              ...state,
              isRunningIme: false,
              event: action.payload.event,
              shouldReRender: hasChangedTextContent,
            };

          case 'finishRender':
            return {
              ...state,
              isRunningIme: false,
              shouldReRender: false,
            };

          default:
            return state;
        }
      }, initialState),
      share(),
    );
  }

  ngAfterViewInit() {
    const el = this.inputRef.nativeElement;

    ((fromEvent(el, 'keydown') as Observable<KeyboardEvent>).pipe(
      tap(ev => this.dispatcher$.next({ type: 'keydown', payload: ev })),
      publishLast(),
    ) as ConnectableObservable<any>).connect();

    ((fromEvent(el, 'keypress') as Observable<KeyboardEvent>).pipe(
      tap(() => this.dispatcher$.next({ type: 'finishIme' })),
      publishLast(),
    ) as ConnectableObservable<any>).connect();

    ((fromEvent(el, 'keyup') as Observable<KeyboardEvent>).pipe(
      tap(ev => {
        const { element, offset } = getAnchor();
        return this.dispatcher$.next({
          type: 'keyup',
          payload: {
            event: ev,
            anchorElement: element,
            anchorOffset: offset,
          },
        });
      }),
      publishLast(),
    ) as ConnectableObservable<any>).connect();

    this.store$
      .pipe(filter(state => !state.isRunningIme && state.shouldReRender))
      .subscribe(({ event }) => {
        if (!event) {
          throw new Error();
        }
        const target = event.target as HTMLDivElement;
        if (!target) {
          throw new Error();
        }

        const { element: anchorElement } = getAnchor();

        const targetIdx = Array.from(target.children).findIndex(
          v => v === anchorElement,
        );
        const splitted = this.model.reduce(
          (acc, v, i) => {
            if (i < targetIdx) {
              acc.a = acc.a.concat(v);
            } else if (i === targetIdx) {
              return acc; // skip
            } else {
              acc.b = acc.b.concat(v);
            }
            return acc;
          },
          { a: [] as Model[], b: [] as Model[] },
        );

        const innerText = target.innerText;
        if (/%%%.+%%%/.test(innerText)) {
          const matched = (innerText.match(
            /%%%(.+?)%%%/,
          ) as RegExpMatchArray)[1];

          const newItems = anchorElement.innerText
            .split('%%%')
            .filter(v => !!v)
            .map(v => {
              return { text: v, isElement: matched === v };
            });

          this.model = [...splitted.a, ...newItems, ...splitted.b];
        }

        requestAnimationFrame(() => {
          this.dispatcher$.next({ type: 'finishRender' });
        });
      });
  }
}
