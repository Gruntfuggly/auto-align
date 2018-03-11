# Auto Align

<img src="https://raw.githubusercontent.com/Gruntfuggly/auto-align/master/auto-align.gif">

This is basically a poor man's spreadsheet. It auto formats a file, aligning columns by padding with spaces. It uses commas for .csv files and vertical bars for .bsv files. You can also add other separators for other file types if you want.

It will find the first and last lines in the file containing the separator and format all lines between.

Note: If you need to add or remove columns, currently you MUST modify the first line containing the separator, otherwise you might lose some file content. A forthcoming update will allow any line to be modiied.

Another Note: I wrote this because I often feel the need to write files in a simple table format, but don't want to use Excel. It is probably very inefficient and may fail in lots of ways. YMMV...

#### TODO: Allow changing number of columns from any line
#### TODO: Highight headings in bold (or something)
#### TODO: Add sort functionality

## Installing

You can install the latest version of the extension via the Visual Studio Marketplace [here](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.auto-align).

Alternatively, open Visual Studio code, press `Ctrl+P` or `Cmd+P` and type:

    > ext install auto-align

### Source Code

The source code is available on GitHub [here](https://github.com/Gruntfuggly/auto-align).

## Configuration

`autoAlign.associations`

This defines which files will be auto aligned, and what separator to use. By default it sets .csv files to commas, and .bsv files to vertical bars. The separator is used as part of a regex. Single character separators are automatically escaped, but if you need a more complicated separator, you may need to escape other characters.

The separator for the current file type can be changed with the **'Auto Align: Change Separator'** command.

`autoAlign.enabled`

Set this to false to disable auto formatting for the associated file extension.

This flag can be set using the command **'Auto Align: Enable auto align mode'** and **'Auto Align: Disable auto align mode'**. Alternatively, it can be quickly changed by clicking the **'Auto Align'** button on the status bar.

`autoAlign.delay`

This is the delay after which the file is formatted when you stop typing.

## Known issues

Adding and removing columns must be done by modifying the first line of the file containing a separator.

## Credits

I shamelessly stole the alignment code from [dakara](https://marketplace.visualstudio.com/search?term=publisher%3A%22dakara%22&target=VSCode&category=All%20categories&sortBy=Relevance)'s [Transformer](https://marketplace.visualstudio.com/items?itemName=dakara.transformer) extension.

Icon from [deleket](http://www.softicons.com/designers/deleket)
