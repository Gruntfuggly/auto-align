
var vscode = require( 'vscode' );

function activate( context )
{
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
            lines[ linePartIndex ] = lines[ linePartIndex ] + delimeter

        }
    }

    function padRight( text, count )
    {
        const padAmount = count - text.length;
        return text + ' '.repeat( padAmount );
    }

    function trim( text )
    {
        return text.replace( /\s+$/, '' );
    };

    function maxLength( texts, partIndex )
    {
        let max = 0;
        return texts.map( text => text[ partIndex ].length ).reduce( ( prev, curr ) =>
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
        linesParts.map( function( line )
        {
            line.map( function( part )
            {
                part = trim( part );
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

    function go()
    {
        const textEditor = vscode.window.activeTextEditor;
        const selections = textEditor.selections;
        alignCSV( textEditor, selections );
    }

    var disposable = vscode.commands.registerCommand( 'csv-align-mode.format', function()
    {
        go();
    } );

    vscode.window.onDidChangeTextEditorSelection( ( e ) => { go( e ); } );
    vscode.window.onDidChangeActiveTextEditor( ( e ) => { go( e ); } );

    context.subscriptions.push( disposable );
}
exports.activate = activate;

function deactivate()
{
}
exports.deactivate = deactivate;
