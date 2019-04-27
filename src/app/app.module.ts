import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { VariableInputComponent } from './variable-input/component';

@NgModule({
  imports: [BrowserModule],
  providers: [],
  declarations: [AppComponent, VariableInputComponent],
  bootstrap: [AppComponent],
})
export class AppModule {}
