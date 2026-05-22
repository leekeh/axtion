# Contributing

Contributions are welcome, from small tweaks and bugfixes to large features. If you have an idea, feel free to submit an issue or start a draft. Drafts are not guaranteed to be picked up, this will be based on availability.

If you used AI to write code, you **MUST** manually verify that the code is of high quality and aligned with our standards.

Test your changes before submitting a PR for review, by running it against a sample app. You can use a sample app of your choosing.

## Code guidelines

- Prioritize development experience: do not make the user-facing API more complex. New features should be opt-in and not break existing patterns.
- Do not introduce additional dependencies unless you think there is a valid use case. Dependencies add risk of vulnerabilities, bulk to the CI, and work to maintain.
- Follow best practices for node and typescript, such as using the `node:` protocol for importing. Consider installing the SonarQube extension for Visual Studio Code for inline suggestions.
