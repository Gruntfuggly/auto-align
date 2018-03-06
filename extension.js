
var vscode = require( 'vscode' ),
    path = require( 'path' );

function activate( context )
{
    var enabled = false;

    var button = vscode.window.createStatusBarItem( vscode.StatusBarAlignment.Left, 0 );

    var formatTimeout;

    String.prototype.rtrim = function() { return this.replace( /\s+$/, '' ); };

    function collectLines( document, startLine, endLine )
    {
        const lines = [];
        for( let index = startLine; index <= endLine; index++ )
        {
            lines.push( document.lineAt( index ) );
        }
        return lines;
    }

    function linesFromRange( document, range )
    {
        const startLine = range.start.line;
        const endLine = range.end.line;

        return collectLines( document, startLine, endLine );
    }

    function linesFromRanges( document, ranges )
    {
        return ranges.map( range => linesFromRange( document, range ) ).reduce( ( acc, cur ) => acc.concat( cur ) );
    }

    function findLastLineOfBlock( document, lineNumber, isInBlock )
    {
        const line = document.lineAt( lineNumber );
        let previousLine = line;
        const documentLength = document.lineCount;
        for( let index = lineNumber + 1; index < documentLength; index++ )
        {
            const nextLine = document.lineAt( index );
            if( !isInBlock( nextLine ) ) break;
            previousLine = nextLine;
        }
        return previousLine;
    }

    function findFirstLineOfBlock( document, lineNumber, isInBlock )
    {
        const line = document.lineAt( lineNumber );
        let previousLine = line;
        for( let index = lineNumber - 1; index >= 0; index-- )
        {
            const nextLine = document.lineAt( index );
            if( !isInBlock( nextLine ) ) break;
            previousLine = nextLine;
        }
        return previousLine;
    }

    function expandRangeToBlockIfEmpty( textEditor, range )
    {
        if( range.isSingleLine && range.start.character === range.end.character )
        {
            const firstLineOfBlock = findFirstLineOfBlock( textEditor.document, range.start.line, line => !line.isEmptyOrWhitespace );
            const lastLineOfBlock = findLastLineOfBlock( textEditor.document, range.start.line, line => !line.isEmptyOrWhitespace );
            return new vscode.Range( new vscode.Position( firstLineOfBlock.lineNumber, 0 ), new vscode.Position( lastLineOfBlock.lineNumber, lastLineOfBlock.range.end.character ) );
        }
        return range;
    }

    function linesFromRangesExpandBlockIfEmpty( textEditor, ranges )
    {
        if( ranges.length === 1 )
        {
            ranges[ 0 ] = expandRangeToBlockIfEmpty( textEditor, ranges[ 0 ] );
        }
        return linesFromRanges( textEditor.document, ranges );
    }

    function appendColumn( lines, linesParts, max )
    {
        for( let linePartIndex = 0; linePartIndex < linesParts.length; linePartIndex++ )
        {
            const part = padRight( linesParts[ linePartIndex ].shift(), max );

            if( lines[ linePartIndex ] == undefined ) lines[ linePartIndex ] = '';
            lines[ linePartIndex ] += part;
        }
    }

    function appendDelimeter( lines, delimeter )
    {
        for( let linePartIndex = 0; linePartIndex < lines.length; linePartIndex++ )
        {
            lines[ linePartIndex ] = lines[ linePartIndex ] + delimeter;
        }
    }

    function padRight( text, count )
    {
        const padAmount = text ? ( count - text.length ) : count;
        return ( text ? text : "" ) + ' '.repeat( padAmount );
    }

    function trim( text )
    {
        return text.replace( /^\s+|\s+$/g, '' );
    };

    function maxLength( texts, partIndex )
    {
        let max = 0;
        return texts.map( text => ( text[ partIndex ] ? text[ partIndex ].length : 0 ) ).reduce( ( prev, curr ) =>
        {
            return curr >= prev ? curr : prev;
        } )
    }

    function replaceLinesWithText( textEditor, linesOld, linesNew )
    {
        textEditor.edit( function( editBuilder )
        {
            let lineIndex = 0;
            linesOld.forEach( line =>
            {
                editBuilder.replace( line.range, linesNew[ lineIndex ] );
                lineIndex++;
            } );
        }, { undoStopAfter: false, undoStopBefore: false } )
    }

    function alignCSV( textEditor, ranges )
    {
        const lines = linesFromRangesExpandBlockIfEmpty( textEditor, ranges );
        var linesParts = lines.map( line => line.text.split( ',' ) );
        linesParts = linesParts.map( function( line )
        {
            return line.map( function( part, index )
            {
                return ( index === 0 ? "" : " " ) + trim( part );
            } );
        } );
        const newLineTexts = []
        const linePartCount = linesParts[ 0 ].length;
        for( let columnIndex = 0; columnIndex < linePartCount; columnIndex++ )
        {
            const max = maxLength( linesParts, 0 );
            appendColumn( newLineTexts, linesParts, max );
            if( columnIndex != linePartCount - 1 )
                appendDelimeter( newLineTexts, ',' );
        }

        replaceLinesWithText( textEditor, lines, newLineTexts );
    }

    const decorationType = vscode.window.createTextEditorDecorationType( {
        light: { color: "#cccccc" },
        dark: { color: "#444444" }
    } );

    function decorate()
    {
        var highlights = [];

        const editor = vscode.window.activeTextEditor;

        if( enabled )
        {
            const text = editor.document.getText();

            var pattern = new RegExp( ",", 'g' );
            let match;
            while( match = pattern.exec( text ) )
            {
                const startPos = editor.document.positionAt( match.index );
                const endPos = editor.document.positionAt( match.index + match[ 0 ].length );
                const decoration = { range: new vscode.Range( startPos, endPos ) };
                highlights.push( decoration );
            }
        }

        editor.setDecorations( decorationType, highlights );
    }

    function align()
    {
        if( enabled )
        {
            const editor = vscode.window.activeTextEditor;

            if( editor )
            {
                const text = editor.document.getText();

                const selections = [];
                selections.push( new vscode.Range( editor.document.positionAt( 0 ), editor.document.positionAt( text.length - 1 ) ) );
                alignCSV( editor, selections );
            }
        }
    }

    function positionCursor()
    {
        if( enabled )
        {
            const editor = vscode.window.activeTextEditor;

            if( editor )
            {
                const text = editor.document.getText();

                var selection = editor.selection;
                var cursorPos = editor.document.offsetAt( selection.start );
                var currentWordRange = editor.document.getWordRangeAtPosition( selection.active, /(^.*?,|,.*?$)/ );
                if( currentWordRange === undefined )
                {
                    currentWordRange = editor.document.getWordRangeAtPosition( selection.active, /,.*?,/ );
                }
                var currentWord = text.substring( editor.document.offsetAt( currentWordRange.start ) + 1, editor.document.offsetAt( currentWordRange.end ) - 1 );
                var currentWordStart = editor.document.offsetAt( currentWordRange.start ) + 1;
                var currentWordEnd = currentWordStart + currentWord.rtrim().length + 1;
                if( cursorPos > currentWordEnd )
                {
                    var position = editor.document.positionAt( currentWordEnd );
                    editor.selection = new vscode.Selection( position, position );
                    editor.revealRange( editor.selection, vscode.TextEditorRevealType.Default );
                }
            }
        }
    }

    function go( e )
    {
        clearTimeout( formatTimeout );
        const editor = vscode.window.activeTextEditor;
        if( editor && path.extname( editor.document.fileName ) === ".csv" )
        {
            formatTimeout = setTimeout( function()
            {
                align();
                positionCursor();
                setTimeout( decorate, 200 );
            }, 1000 );
        }
    }

    function setButton()
    {
        button.text = "Auto Align: $(thumbs" + ( enabled ? "up" : "down" ) + ")";
        button.command = 'csv-align-mode.' + ( enabled ? 'disable' : 'enable' );
        button.show();
    }

    function enable()
    {
        enabled = true;
        setButton();
        go();
    }

    function disable()
    {
        enabled = false;
        setButton();
        setTimeout( decorate, 200 );
    }

    context.subscriptions.push( vscode.commands.registerCommand( 'csv-align-mode.format', align ) );
    context.subscriptions.push( vscode.commands.registerCommand( 'csv-align-mode.enable', enable ) );
    context.subscriptions.push( vscode.commands.registerCommand( 'csv-align-mode.disable', disable ) );

    vscode.window.onDidChangeTextEditorSelection( go );
    vscode.window.onDidChangeActiveTextEditor( go );

    enable();
}
exports.activate = activate;

function deactivate()
{
}
exports.deactivate = deactivate;
