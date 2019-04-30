import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'ngx-variable-input';
  tags = [{ text: 'a', isElement: true }, { text: 'b', isElement: true }];

  onInputText(v: string) {
    console.log(v);
  }

  onChangeTags(v: any[]) {
    console.log(v);
  }
}
