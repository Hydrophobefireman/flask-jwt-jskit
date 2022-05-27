# NPM Package Gen

A very simple template to create NPM libraries with subpackages without worrying about it

## Usage

Clone this repo

To generate a package

```
yarn create-package YOUR_PACKAGE
```

And you will have a subpackage created in the `packages` directory

To use the code from the main module you'll have to setup your `tsconfig.json`

When you build, this will run microbundle on all the subpackages and before publishing it will copy them to the root, so npm only sees your subpackage output

Your dependencies, peer dependencies will be handled for you

( Change the `replace-me` in your package.json and tsconfig.json to your library's name )
