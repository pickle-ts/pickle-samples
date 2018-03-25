# Pickle Samples

The individual samples are in the /src/client/app folder:

* Counter
  * Demonstrates basic update
* BMI Calculator
  * Demonstrates input controls
* Composition
  * Demonstrates nested components
* Tree
  * Demonstrates nested array components and recursively nested components
* GitSearch
  * Demonstrates async web call, debouncing
* Todos
  * Demonstrates core concepts of a todo app, without the fluff
* Table
  * Demonstrates a custom table component (filter, sort)
* Time Travel
  * Demonstrates time travel and serializing to local storage
* Modal Sample
  * Demonstrates a modal component
* Animate Element
  * Demonstrates animating a single element
* Animate List
  * Demonstrates animating a list
* Samples
  * Sample to demonstrate samples, demonstrates history API integration

The sample uses:

* Webpack 
* Webpack hot reloading
* scss
* CSS Framework: Bootstrap 4
* Icons: material icons ( https://material.io/icons/ )
* Debouncing, sorting: lodash
* history
* ASP.NET Core 2.0 w/ Microsoft.SpaServices
  * Samples easily adaptable to node.js
* popmotion-pose for animations

The /src/boot/start.ts file demonstrates app setup, serializing to local storage & hot module reloading.