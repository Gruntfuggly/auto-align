
var vscode = require( 'vscode' );

function activate( context )
{
    var enabled = false;

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
        return text.replace( /\s+$/, '' );
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
        } )
    }

    function alignCSV( textEditor, ranges )
    {
        const lines = linesFromRangesExpandBlockIfEmpty( textEditor, ranges );
        var linesParts = lines.map( line => line.text.split( ',' ) );
        linesParts = linesParts.map( function( line )
        {
            return line.map( function( part )
            {
                return trim( part );
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
        const editor = vscode.window.activeTextEditor;

        if( enabled )
        {
            const text = editor.document.getText();

            const selections = [];
            selections.push( new vscode.Range( editor.document.positionAt( 0 ), editor.document.positionAt( text.length - 1 ) ) );
            alignCSV( editor, selections );
        }
    }

    function go()
    {
        align();
        setTimeout( decorate, 200 );
    }

    context.subscriptions.push( vscode.commands.registerCommand( 'csv-align-mode.format', function()
    {
        align();
    } ) );

    context.subscriptions.push( vscode.commands.registerCommand( 'csv-align-mode.enable', function()
    {
        enabled = true;
        go();
    } ) );

    context.subscriptions.push( vscode.commands.registerCommand( 'csv-align-mode.disable', function()
    {
        enabled = false;
        setTimeout( decorate, 200 );
    } ) );

    vscode.window.onDidChangeTextEditorSelection( ( e ) => { go( e ); } );
    vscode.window.onDidChangeActiveTextEditor( ( e ) => { go( e ); } );
}
exports.activate = activate;

function deactivate()
{
}
exports.deactivate = deactivate;
