var vscode = require( 'vscode' ),
    path = require( 'path' );

var startEndField;
var innerField;

function activate( context )
{
    var button = vscode.window.createStatusBarItem( vscode.StatusBarAlignment.Left, 0 );

    var formatTimeout;

    String.prototype.rtrim = function() { return this.replace( /\s+$/, '' ); };

    function getExtension()
    {
        var editor = vscode.window.activeTextEditor;
        if( editor && editor.document )
        {
            ext = path.extname( editor.document.fileName );
            if( ext && ext.length > 1 )
            {
                return ext.substr( 1 );
            }
        }
        return "";
    }

    function associatedFileSeparator()
    {
        var associations = vscode.workspace.getConfiguration( 'autoAlign' ).associations;
        return associations ? associations[ getExtension() ] : undefined;
    }

    function updateSeparator()
    {
        var separator = associatedFileSeparator();
        if( separator )
        {
            startEndField = new RegExp( "(^.*?\\" + separator + "|\\" + separator + ".*? $)" );
            innerField = new RegExp( "\\" + separator + ".*?\\" + separator );
        }
    }

    function appendColumn( lines, linesParts, max )
    {
        for( var linePartIndex = 0; linePartIndex < linesParts.length; linePartIndex++ )
        {
            var part = padRight( linesParts[ linePartIndex ].shift(), max );

            if( lines[ linePartIndex ] === undefined ) lines[ linePartIndex ] = '';
            lines[ linePartIndex ] += part;
        }
    }

    function appendDelimeter( lines, delimeter )
    {
        for( var linePartIndex = 0; linePartIndex < lines.length; linePartIndex++ )
        {
            lines[ linePartIndex ] = lines[ linePartIndex ] + delimeter;
        }
    }

    function padRight( text, count )
    {
        var padAmount = text ? ( count - text.length ) : count;
        return ( text ? text : "" ) + ' '.repeat( padAmount );
    }

    function trim( text )
    {
        return text.replace( /^\s+|\s+$/g, '' );
    }

    function maxLength( texts, partIndex )
    {
        var max = 0;
        return texts.map( text => ( text[ partIndex ] ? text[ partIndex ].length : 0 ) ).reduce( ( prev, curr ) =>
        {
            return curr >= prev ? curr : prev;
        } );
    }

    function replaceLinesWithText( textEditor, linesOld, linesNew )
    {
        textEditor.edit( function( editBuilder )
        {
            var lineIndex = 0;
            linesOld.forEach( line =>
            {
                editBuilder.replace( line.range, linesNew[ lineIndex ] );
                lineIndex++;
            } );
        }, { undoStopAfter: false, undoStopBefore: false } );
    }

    function alignCSV( textEditor, ranges )
    {
        var separator = associatedFileSeparator();
        var document = textEditor.document;
        var text = document.getText();
        var firstLine = document.positionAt( text.indexOf( separator ) );
        var lastLine = document.positionAt( text.lastIndexOf( separator ) );

        var lines = [];
        for( var index = firstLine.line; index <= lastLine.line; index++ )
        {
            lines.push( document.lineAt( index ) );
        }

        var linesParts = lines.map( line => line.text.split( separator ) );
        var extraSpace = vscode.workspace.getConfiguration( 'autoAlign' ).extraSpace === true ? " " : "";
        linesParts = linesParts.map( function( line )
        {
            return line.map( function( part, index )
            {
                return ( index === 0 ? "" : extraSpace ) + trim( part );
            } );
        } );
        var newLineTexts = [];
        var linePartCount = linesParts[ 0 ].length;
        for( var columnIndex = 0; columnIndex < linePartCount; columnIndex++ )
        {
            var max = maxLength( linesParts, 0 );
            appendColumn( newLineTexts, linesParts, max );
            if( columnIndex != linePartCount - 1 )
                appendDelimeter( newLineTexts, separator );
        }

        replaceLinesWithText( textEditor, lines, newLineTexts );
    }

    var decorationType = vscode.window.createTextEditorDecorationType( {
        light: { color: "#cccccc" },
        dark: { color: "#444444" }
    } );

    function decorate()
    {
        var editor = vscode.window.activeTextEditor;

        var highlights = [];

        if( vscode.workspace.getConfiguration( 'autoAlign' ).dimSeparators === true )
        {
            var separator = associatedFileSeparator();

            if( vscode.workspace.getConfiguration( 'autoAlign' ).enabled[ getExtension() ] )
            {
                var text = editor.document.getText();

                var pattern = new RegExp( "\\" + separator, 'g' );
                var match;
                while( match = pattern.exec( text ) )
                {
                    var startPos = editor.document.positionAt( match.index );
                    var endPos = editor.document.positionAt( match.index + match[ 0 ].length );
                    var decoration = { range: new vscode.Range( startPos, endPos ) };
                    highlights.push( decoration );
                }
            }
        }

        editor.setDecorations( decorationType, highlights );
    }

    function align()
    {
        var editor = vscode.window.activeTextEditor;

        if( editor )
        {
            var text = editor.document.getText();

            var selections = [];
            selections.push( new vscode.Range( editor.document.positionAt( 0 ), editor.document.positionAt( text.length - 1 ) ) );
            alignCSV( editor, selections );
        }
    }

    function positionCursor()
    {
        var editor = vscode.window.activeTextEditor;

        if( editor )
        {
            var text = editor.document.getText();

            var selection = editor.selection;
            var cursorPos = editor.document.offsetAt( selection.start );
            var currentWordRange = editor.document.getWordRangeAtPosition( selection.active, startEndField );
            if( currentWordRange === undefined )
            {
                currentWordRange = editor.document.getWordRangeAtPosition( selection.active, innerField );
            }
            if( currentWordRange )
            {
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
            else
            {
                console.log( "Failed to find current word" );
            }
        }
    }

    function go( e )
    {
        clearTimeout( formatTimeout );
        if( vscode.workspace.getConfiguration( 'autoAlign' ).enabled[ getExtension() ] )
        {
            var editor = vscode.window.activeTextEditor;

            var delay = vscode.workspace.getConfiguration( 'autoAlign' ).delay;
            if( e && ( e.kind && e.kind == vscode.TextEditorSelectionChangeKind.Mouse ) )
            {
                delay = 0;
            }

            formatTimeout = setTimeout( function()
            {
                if( e.kind === undefined || e.kind == vscode.TextEditorSelectionChangeKind.Keyboard )
                {
                    align();
                }
                positionCursor();
                setTimeout( decorate, 100 );
            }, delay );
        }
    }

    function setButton( filename )
    {
        var enabled = vscode.workspace.getConfiguration( 'autoAlign' ).enabled[ getExtension() ] === true;

        button.text = "Auto Align: $(thumbs" + ( enabled ? "up" : "down" ) + ")";
        button.command = 'auto-align.' + ( enabled ? 'disable' : 'enable' );
        if( associatedFileSeparator() )
        {
            button.show();
        }
        else
        {
            button.hide();
        }
    }

    function enable()
    {
        var enabled = vscode.workspace.getConfiguration( 'autoAlign' ).enabled;
        enabled[ getExtension() ] = true;
        vscode.workspace.getConfiguration( 'autoAlign' ).update( 'enabled', enabled, true ).then(
            function()
            {
                setButton();
                go( { decorateNow: true } );
            }
        );

    }

    function disable()
    {
        var enabled = vscode.workspace.getConfiguration( 'autoAlign' ).enabled;
        enabled[ getExtension() ] = false;
        vscode.workspace.getConfiguration( 'autoAlign' ).update( 'enabled', enabled, true ).then(
            function()
            {
                setButton();
                setTimeout( decorate, 100 );
            }
        );
    }

    function changeSeparator()
    {
        var editor = vscode.window.activeTextEditor;
        var prompt = "Enter the separator for ." + getExtension() + " files";
        var oldSeparator = associatedFileSeparator();
        vscode.window.showInputBox( { prompt: prompt + " (current:\"" + oldSeparator + "\"):" } ).then(
            function( newSeparator )
            {
                if( newSeparator )
                {
                    var associations = vscode.workspace.getConfiguration( 'autoAlign' ).associations;
                    var updated = function()
                    {
                        separator = newSeparator;
                        setButton();
                        updateSeparator();
                        go( {} );
                    }
                    if( editor.document )
                    {
                        associations[ getExtension() ] = newSeparator;
                        vscode.workspace.getConfiguration( 'autoAlign' ).update( 'associations', associations, true ).then( updated );
                    }
                }
            } );
    }

    context.subscriptions.push( vscode.commands.registerCommand( 'auto-align.changeSeparator', changeSeparator ) );
    context.subscriptions.push( vscode.commands.registerCommand( 'auto-align.format', align ) );
    context.subscriptions.push( vscode.commands.registerCommand( 'auto-align.enable', enable ) );
    context.subscriptions.push( vscode.commands.registerCommand( 'auto-align.disable', disable ) );

    vscode.window.onDidChangeTextEditorSelection( go );
    vscode.window.onDidChangeActiveTextEditor( function( e )
    {
        if( vscode.workspace.getConfiguration( 'autoAlign' ).enabled[ getExtension() ] )
        {
            updateSeparator();
            setButton( e.document.fileName );
            go( {} );
        }
        else
        {
            setButton();
        }
    } );

    updateSeparator();

    var editor = vscode.window.activeTextEditor;

    if( editor && editor.document )
    {
        setButton( editor.document.fileName );
        go( {} );
    }
}

exports.activate = activate;

function deactivate()
{
}
exports.deactivate = deactivate;
