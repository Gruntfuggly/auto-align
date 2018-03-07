
var vscode = require( 'vscode' ),
    path = require( 'path' );

const separator = "|";

const startEndField = new RegExp( "(^.*?\\" + separator + "|\\" + separator + ".*? $)" );
const innerField = new RegExp( "\\" + separator + ".*?\\" + separator );

function activate( context )
{
    var enabled = true;

    var button = vscode.window.createStatusBarItem( vscode.StatusBarAlignment.Left, 0 );

    var formatTimeout;

    String.prototype.rtrim = function() { return this.replace( /\s+$/, '' ); };

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
        const document = textEditor.document;
        const text = document.getText();
        var firstLine = document.positionAt( text.indexOf( separator ) );
        var lastLine = document.positionAt( text.lastIndexOf( separator ) );

        const lines = [];
        for( let index = firstLine.line; index <= lastLine.line; index++ )
        {
            lines.push( document.lineAt( index ) );
        }

        var linesParts = lines.map( line => line.text.split( separator ) );
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
                appendDelimeter( newLineTexts, separator );
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

            var pattern = new RegExp( "\\" + separator, 'g' );
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
        const editor = vscode.window.activeTextEditor;

        if( editor )
        {
            const text = editor.document.getText();

            const selections = [];
            selections.push( new vscode.Range( editor.document.positionAt( 0 ), editor.document.positionAt( text.length - 1 ) ) );
            alignCSV( editor, selections );
        }
    }

    function positionCursor()
    {
        const editor = vscode.window.activeTextEditor;

        if( editor )
        {
            const text = editor.document.getText();

            var selection = editor.selection;
            var cursorPos = editor.document.offsetAt( selection.start );
            var currentWordRange = editor.document.getWordRangeAtPosition( selection.active, startEndField );
            if( currentWordRange === undefined )
            {
                currentWordRange = editor.document.getWordRangeAtPosition( selection.active, innerField );
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

    function go( e )
    {
        clearTimeout( formatTimeout );
        if( enabled )
        {
            const editor = vscode.window.activeTextEditor;
            if( editor && path.extname( editor.document.fileName ) === ".csv" )
            {
                var delay = 1000;
                if( e && e.kind && e.kind == vscode.TextEditorSelectionChangeKind.Mouse )
                {
                    delay = 0;
                }

                formatTimeout = setTimeout( function()
                {
                    align();
                    positionCursor();
                    setTimeout( decorate, 100 );
                }, delay );
            }
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
        setTimeout( decorate, 100 );
    }

    context.subscriptions.push( vscode.commands.registerCommand( 'csv-align-mode.format', align ) );
    context.subscriptions.push( vscode.commands.registerCommand( 'csv-align-mode.enable', enable ) );
    context.subscriptions.push( vscode.commands.registerCommand( 'csv-align-mode.disable', disable ) );

    vscode.window.onDidChangeTextEditorSelection( go );
    vscode.window.onDidChangeActiveTextEditor( function( e )
    {
        setButton();
        if( e && e.document && path.extname( e.document.fileName ) === ".csv" )
        {
            button.show();
            go();
        }
        else
        {
            button.hide();
        }
    } );
}

exports.activate = activate;

function deactivate()
{
}
exports.deactivate = deactivate;
