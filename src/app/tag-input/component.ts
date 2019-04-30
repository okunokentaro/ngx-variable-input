import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnInit,
  Input,
  Output,
  EventEmitter,
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
  anchorNode: Node;
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
    anchorNode,
    element: anchorNode.parentNode as HTMLSpanElement,
    offset: anchorOffset,
  };
}

@Component({
  selector: 'app-tag-input',
  templateUrl: './component.html',
})
export class TagInputComponent implements OnInit, AfterViewInit {
  @ViewChild('input') inputRef!: ElementRef<HTMLDivElement>;
  @Input() model: Model[] = [];
  @Output() inputText = new EventEmitter<string>();
  @Output() changeTags = new EventEmitter<Model[]>();

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

        if (event.key === 'Backspace') {
          const tags = target.querySelectorAll('.Text-isElement');
          const prevCount_ = this.model.length;
          this.model = Array.from(tags).map(v => {
            return { text: (v as HTMLSpanElement).innerText, isElement: true };
          });
          const currentCount_ = this.model.length;
          if (currentCount_ < prevCount_) {
            this.emitChanges();
          }
          return;
        }

        const { anchorNode } = getAnchor();

        const nodeValue = anchorNode.nodeValue || '';
        const prevCount = this.model.length;
        if (/.+,/.test(nodeValue)) {
          const matched = (nodeValue.match(/^(.+?),/) as RegExpMatchArray)[1];

          const newItem = nodeValue
            .split(',')
            .filter(v => !!v)
            .map(v => {
              return { text: v.trim(), isElement: matched === v };
            })[0];

          Array.from(target.childNodes).forEach(node => {
            if (node.nodeType === 3 /* text */) {
              target.removeChild(node);
            }
            if (
              (node as HTMLSpanElement).className &&
              (node as HTMLSpanElement).className.includes('End') /* text */
            ) {
              target.removeChild(node);
              const newEndNode = document.createElement('span');
              newEndNode.className = 'End';
              target.appendChild(newEndNode);
            }
          });

          if (this.model.every(v => v.text !== newItem.text)) {
            this.model = [...this.model, newItem];
          }
        }
        const currentCount = this.model.length;

        requestAnimationFrame(() => {
          this.dispatcher$.next({ type: 'finishRender' });

          const node = this.inputRef.nativeElement.querySelector('.End');
          if (!node) {
            throw new Error();
          }

          if (currentCount === prevCount) {
            this.emitTypingText((node as HTMLSpanElement).innerText);
            return;
          }

          if (prevCount < currentCount) {
            const { selectionRef } = getAnchor();
            const range = document.createRange();

            range.setStart(node, 0);
            range.setEnd(node, 0);
            selectionRef.removeAllRanges();
            selectionRef.addRange(range);
            this.emitChanges();
            return;
          }
        });
      });
  }

  private emitTypingText(text: string) {
    this.inputText.emit(text);
  }

  private emitChanges() {
    this.changeTags.emit([...this.model]);
  }
}
