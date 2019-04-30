import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { VariableInputComponent } from './variable-input/component';
import { TagInputComponent } from './tag-input/component';

@NgModule({
  imports: [BrowserModule],
  providers: [],
  declarations: [AppComponent, VariableInputComponent, TagInputComponent],
  bootstrap: [AppComponent],
})
export class AppModule {}
