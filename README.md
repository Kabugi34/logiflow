# Logiflow

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.24.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Local authentication demo

Auth API requests are simulated locally by `mockAuthInterceptor` while
`useMockAuth` is `true` in `src/app/core/api/api.config.ts`. The mock returns
the same response shapes used by `AuthApiService` and `AuthService`; it does
not replace those services or change their HTTP contract.

Use either seeded account with password `LogiflowDemo1!`:

| Workspace | Email |
| --- | --- |
| Manufacturer | `manufacturer@logiflow.demo` |
| Distributor | `distributor@logiflow.demo` |

Set `useMockAuth` to `false` when the backend is available. Login, refresh,
logout, and current-user requests will then use the configured API URL. The
mock is for local development and reviewer demos only; it has no real database
or security enforcement.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
