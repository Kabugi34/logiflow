import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { assertProductionSafeConfig } from './app/core/api/production-safety';

assertProductionSafeConfig();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
