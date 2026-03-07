# Wysi
_Fork by [Daniel Leszczak](https://github.com/deszczak/text-editor)_

This is a fork of [Wysi](https://github.com/mdbassit/Wysi) by [Momo Bassit](https://github.com/mdbassit).
It's a lightweight and simple WYSIWYG editor written in vanilla ES6 with no dependencies.
You can also learn more about it [here](https://wysi.js.org/) and see the demo.

My version removes some things that I don't need and adds some features that I do need.

## What's removed?
1. Text alignment
2. Outdent and indent
3. Image upload
4. Translations

## What's added?
1. Custom undo/redo system
2. Text highlighting
3. Auto format*
4. Copy as Markdown
5. Toast messages on: "Auto format", "Remove format", "copy as Markdown", "Undo" and "Redo"
6. Custom actions support
7. Disable the "Heading 1" button when the editor's content already has an H1 element

\* Puts non-breaking spaces after orphan words
and removes them from where they shouldn't be – e.g., from before punctuation.
It also replaces hyphens surrounded by spaces with en-dash.

## What's changed?
I made the entire editor (not only the toolbar) aware of user's `prefer-color-scheme`
and removed the previous darkMode parameter. I also exchnged the `cleanCSS` for `cssnano`
in the build process to allow for newer CSS features like nesting
and overall changed some things for my own needs.

**FYI:** you'll probably find the original codebase more friendly and like it more :D

### Why did I do that?
I searched for a WYSIWYG editor that I could use in my notes app, and Wysi was the closest to it.

---

## Basic usage

Download and add the script and style **min** files to your page:
```html
<link rel="stylesheet" href="wysi.min.css"/>
<script src="wysi.min.js"></script>
```

Then create an editor instance using a CSS selector pointing to one or more `textarea` elements:
```html
<textarea id="demo1"></textarea>
<script>
Wysi({
  el: '#demo1'
})
</script>
```

This will convert the textarea element to a WYSIWYG editor with the default settings.

### Getting the content

The content of an editor can be retrieved simply by reading the `value` property of the original textarea element:
```js
const content = document.querySelector('#demo1').value;
```

Alternatively, the `onChange` function can be used to achieve the same result (see below).

### Customizing the editor

The editor can be configured by calling `Wysi()` and passing an options object to it.
Here is a list of all the available options:

```js
Wysi({
  
  // A selector pointing to one or more textarea elements to convert into WYSIWYG editors.
  // This can also accept a Node, a NodeList, an HTMLCollection or an array of DOM elements.
  el: '.richtext',

  // The height of the editable region.
  height: 200,

  // Grow the editor instance to fit its content automatically.
  // The height option above will serve as the minimum height.
  autoGrow: false,
  
  // Automatically hide the toolbar when the editable region is not focused.
  autoHide: false,

  // The toolbar configuration. '|' separates the buttons. '-' separates the lines.
  tools: [
    'goBack', // Custom action
    'format', '|',
    'bold', 'italic', 'underline', 'strike', 'highlight', '|',
    'ul', 'ol', '|',
    'link', 'hr', 'quote', '|',
    'autoFormat', 'removeFormat', '|',
    'markdownExport'
  ],

  // A function that is called whenever the content of the editor instance changes.
  // The new content is passed to the function as an argument.
  onChange: (content) => console.log(content),
  
  // Object of custom actions – name: { innerHTML: icon|text, label: string, action: fn(editor){} }
  customActions: {
    goBack: {
      innerHTML: `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      `,
      label: 'Go back',
      action: (editor) => {
        console.log(editor.innerHTML)
        Wysi.destroy('.richtext')
        console.log('Custom action – Go back – was executed.');
      }
    }
  }
})
```

## Forking

Feel free to do so~

## Contributing

If you find a bug or would like to implement a missing feature,
please visit the original repository and create an issue or a pull request there.

## License

Copyright © 2023 Momo Bassit _+ 2026 Daniel Leszczak_.  
All **Wysi** instances are licensed under the [MIT license](https://github.com/mdbassit/Wysi/blob/main/LICENSE.txt).