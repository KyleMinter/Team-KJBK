import { getAudioFlagDecorationType, getAudioFlagStorage } from "../extension";
import {
	Position,
	Selection,
	TextEditor,
    TextDocument,
	window,
	workspace,
    Range,
    Memento,
    WorkspaceEdit,
    Uri
} from "vscode";
import { CommandEntry } from "./commandEntry";

export const audioFlagCommands: CommandEntry[] = [
    {
        name: "mind-reader.addAudioFlag",
        callback: addAudioFlag
    },
    {
        name: "mind-reader.deleteAudioFlag",
        callback: deleteAudioFlag
    },
    {
        name: "mind-reader.moveToAudioFlag",
        callback: moveToAudioFlag
    }
];
import player = require('play-sound');

const soundPlayer = player();

// Map to store audio flags for each text document.
const openDocuments = new Map<string, Document>();

/*
    ------------------------------------------------------------------------------------------------------------------------------------
    
    COMMAND CALLBACK FUNCTIONS

    ------------------------------------------------------------------------------------------------------------------------------------
*/

async function addAudioFlag(): Promise<void> {
    const editor: TextEditor | undefined = window.activeTextEditor;

    // Throw error if no editor open
    if (!editor) {
        window.showErrorMessage("AddAudioFlag: No Active Editor");
        return;
    }

    // Check if the document has been saved yet.
    if (editor.document.isUntitled) {
        window.showErrorMessage("AudioFlag: Document must be saved before using audio flags!");
        return;
    }

    // Get the open document and check for errors.
    let document = openDocuments.get(editor.document.fileName);
    if (document === undefined) {
        document = new Document(editor.document.fileName, editor.document.lineCount);
        openDocuments.set(editor.document.fileName, document);
    }
    
    // Throw error if there is already an audio flag on the active line.
    const audioFlagPositions = document.audioFlagPositions;
    if (audioFlagPositions.indexOf(getLineNumber(editor)) !== -1) {
        window.showErrorMessage("AddAudioFlag: Prexisting Audio Flag Present");
        return;
    }

    // Add the audio flag to the position set and sort the set in numerical order.
    audioFlagPositions.push(getLineNumber(editor));
    audioFlagPositions.sort(function(a, b) {
        return a - b;
    });

    //play sound when flag is added
    playSound('C:\Users\Palli\Documents\GitHub\Team-KJBK\media\Flag Sounds\Pluck 1.mp3');

    // Update the audio flag decorations and mark the document as dirty.
    updateAudioFlagDecorations();
    await markActiveDocumentAsDirty();

    editor.revealRange(editor.selection, 1); // Make sure cursor is within range
    window.showTextDocument(editor.document, editor.viewColumn); // You are able to type without reclicking in document

    
}

async function deleteAudioFlag(): Promise<void> {
    const editor: TextEditor | undefined = window.activeTextEditor;

    // Throw error if no editor open
    if (!editor) {
        window.showErrorMessage("AddAudioFlag: No Active Editor");
        return;
    }

    // Get the open document and check for errors.
    const document = openDocuments.get(editor.document.fileName);
    if (document === undefined) {
        window.showErrorMessage("AudioFlag: File Initialization Error");
        return;
    }

    const audioFlagPositions = document.audioFlagPositions;
    
    const index = audioFlagPositions.indexOf(getLineNumber(editor));

    // Throw error an audio flag isn't on the active line.
    if (index === -1) {
        window.showErrorMessage("DeleteAudioFlag: No Prexisting Audio Flag Present");
        return;
    }
    
    // Remove the audio flag from the position set.
    audioFlagPositions.splice(index, 1);

    // Update the audio flag decorations and mark the document as dirty.
    updateAudioFlagDecorations();
    await markActiveDocumentAsDirty();

    editor.revealRange(editor.selection, 1); // Make sure cursor is within range
    window.showTextDocument(editor.document, editor.viewColumn); // You are able to type without reclicking in document
}

async function moveToAudioFlag(): Promise<void> {
    const editor: TextEditor | undefined = window.activeTextEditor;

    // Throw error if no editor open
    if (!editor) {
        window.showErrorMessage("AddAudioFlag: No Active Editor");
        return;
    }

    // Get the open document and check for errors.
    const document = openDocuments.get(editor.document.fileName);
    if (document === undefined) {
        window.showErrorMessage("MoveToAudioFlag: No Prexisting Audio Flag Present");
        return;
    }

    // Throw error if there are no audio flags in the file.
    const audioFlagPositions = document.audioFlagPositions;
    if (audioFlagPositions.length === 0) {
        window.showErrorMessage("MoveToAudioFlag: No Prexisting Audio Flag Present");
        return;
    }

    let currentLine = editor.selection.active.line; // Save previous position
    let flagLine;
    let lastCharacter;

    // Check if the cursor is already at or past the line number the last audio flag is on. If it is set the cursor to the first audio flag in the file.
    if (audioFlagPositions[audioFlagPositions.length - 1] <= currentLine)
    {
        flagLine = audioFlagPositions[0];
        lastCharacter = editor.document.lineAt(audioFlagPositions[0]).text.length;
    }
    else
    {
        for (let i = 0; i < audioFlagPositions.length; i++)
        {
            let lineNumber = audioFlagPositions[i];
            if (lineNumber > currentLine)
            {
                flagLine = lineNumber;
                lastCharacter = editor.document.lineAt(lineNumber).text.length;
                break;
            }
        }
    }

    // This should never happen, but we check if flagLiune and lastCharacter are undefined so Typescript doesn't complain.
    if (flagLine === undefined || lastCharacter === undefined)
    {
        window.showErrorMessage("MoveToAudioFlag: Move Cursor Error");
        return;
    }

    // Move the cursor and whatnot.
    let newPosition = new Position(flagLine, lastCharacter); // Assign new position to audio flag
    const newSelection = new Selection(newPosition, newPosition);
    editor.selection = newSelection; // Apply change to editor

    editor.revealRange(editor.selection, 1); // Make sure cursor is within range
    window.showTextDocument(editor.document, editor.viewColumn); // You are able to type without reclicking in document
}

/*
    ------------------------------------------------------------------------------------------------------------------------------------
    
    EVENT LISTENER CALLBACK FUNCTIONS

    ------------------------------------------------------------------------------------------------------------------------------------
*/

// Event listener to update audio flag positions upon lines being added/removed from the active document
workspace.onDidChangeTextDocument(event => {
    // Check if the current document has any audio flags in it. If it doesn't we will exit this function.
    const document = openDocuments.get(event.document.fileName);
    if (document === undefined) {
        return;
    }

    const lineCount = document.lineCount;
    
    // Get the new line count after the change was made.
    const newLineCount = event.document.lineCount;

    // If the new line count differs from the previous line count then we will adjust the audio flag positions.
    if (newLineCount !== lineCount)
    {
        // Get the line where the change was made.
        const start: number = event.contentChanges[0].range.start.line;

        // For every audio flag that is positioned on a line after the change, we will update it's position.
        const audioFlagPositions = document.audioFlagPositions;
        audioFlagPositions.forEach((lineNum, index) => {
            if (lineNum >= start && lineCount)
            {
                audioFlagPositions[index] = lineNum + (newLineCount - lineCount);
            }
        });

        // Update the line count.
        document.lineCount = newLineCount;

        // Update the audio flag decorations now that their positions have changed.
        updateAudioFlagDecorations();
    }
})

// Event listener to update audio flag decorations on text editor change.
window.onDidChangeActiveTextEditor(event => {
    if (event && !event.document.isUntitled && openDocuments.get(event.document.fileName) === undefined)
    {
        initializeDocument(event.document);
    }

    updateAudioFlagDecorations();
});

// Event listener to save audio flags upon file save.
workspace.onDidSaveTextDocument(event => {
    if (event)
    {
        const name = event.fileName;
        const document = openDocuments.get(name);
        if (document !== undefined)
        {
            // Get the storage.
            const storage = getAudioFlagStorage();

            // If there are no audio flags in this document then there's no point in saving anything, so we will instead remove it from storage (assuming its already there).
            if (document.audioFlagPositions.length === 0)
            {
                // Delete the document from both storage and the openDocuments map.
                openDocuments.delete(name);
                storage!.setValue(name, undefined);
            }
            else
            {
                // Store the document as normal.
                storage!.setValue(name, document);
            }
        }
    }
});

// Event listener to remove documents from the openDocuments map when they are closed.
workspace.onDidCloseTextDocument(event => {
    if (event)
    {
        openDocuments.delete(event.fileName);
    }
})

/*
    ------------------------------------------------------------------------------------------------------------------------------------
    
    HELPER FUNCTIONS

    ------------------------------------------------------------------------------------------------------------------------------------
*/

/** Helper Function
 ** This function returns the line number of the active text editor window
 *  @param editor the active TextEditor
 *  @returns editor!.selection.active.line
 */
function getLineNumber(editor: TextEditor | undefined): number {
    return editor!.selection.active.line;
}


//Function to play sound for audio flags
//Variable should be the string url for the sound
function playSound(url: string): void {
    soundPlayer.play(url, function(err: Error){
        if(err){
            console.error('Error playing sound: ', err);
        }
        else
        {
            console.log('Sound played successfully');
        }
    })
}

/**
 * Marks the currently active TextDocument as dirty.
 * @returns void Promise
 */
async function markActiveDocumentAsDirty(): Promise<void> {
    const editor: TextEditor | undefined = window.activeTextEditor;

    if (editor)
    {
        const lastLine = editor.document.lineCount - 1; // Get last line
        const lastCharacter = editor.document.lineAt(lastLine).text.length; // Get last character in last line
        let endPosition: Position = new Position(lastLine, lastCharacter); // Assign new position to end
        
        // Inserts a space as the very last character in the file.
        let edits = new WorkspaceEdit();
        edits.insert(editor.document.uri, endPosition, " ");
        await workspace.applyEdit(edits);

        // Removes the previously inserted space.
        let edits2 = new WorkspaceEdit();
        edits2.delete(editor.document.uri, new Range(endPosition, new Position(lastLine, lastCharacter + 1)));
        await workspace.applyEdit(edits2);33
    }
}

/**
 * Updates the Audio Flag Decorations for the active TextEditor.
 * If there are Audio Flags present in the file, a flag icon will be added at the position of each Audio Flag in the gutter section of the TextEditor.
 */
export function updateAudioFlagDecorations(): void {
    const editor: TextEditor | undefined = window.activeTextEditor;

    if (!editor) {
        return;
    }

    // This shouldn't happen, but we will check if the decoration type is null so that Typescript doesn't complain.
    const decoration = getAudioFlagDecorationType();
    if (decoration === undefined)
    {
        window.showErrorMessage("AudioFlag: Decoration Icon Error");
        return;
    }

    // Check if the current document has any audio flags.
    const document = openDocuments.get(editor.document.fileName);
    if (document === undefined)
    {
        // If the document has no audio flags, we will set no lines to have the decoration.
        editor.setDecorations(decoration, []);
    }
    else
    {
        // Set the lines with audio flags to have the decoration.
        const audioFlagPositions = document.audioFlagPositions;
    
        const flagRange: Range[] = [];
        audioFlagPositions.forEach(line => {
            flagRange.push(new Range(line, 0, line, 1));
        });
        
        editor.setDecorations(decoration, flagRange)
    }
}

/**
 * Initializes a TextDocument with it's stored Audio Flags.
 * TextDocuments need to be saved to disk in order to be initialized. If there are no Audio Flags stored then this function will do nothing.
 * @param document the TextDocument to initialize 
 */
export function initializeDocument(document: TextDocument) {
    // Check if the document is saved to disk.
    if (!document.isUntitled)
    {
        // Attempts to get audio flags from storage and initialize them.
        const name = document.fileName;
        const storage = getAudioFlagStorage();
        const savedDocument = storage!.getValue(name);
        if (savedDocument !== undefined)
        {
            openDocuments.set(name, savedDocument);
        }
    }
}

/**
 * A class representing VS Code's Memento which is used for storing audio flags.
 */
export class AudioFlagStorage {
    constructor(private storage: Memento) {
        // Remove any documents from storage that are no longer present in the file system.
        const keys = this.storage.keys();
        keys.forEach(async fileName => {
            try { await workspace.fs.stat((Uri.file(fileName))); }
            catch { this.storage.update(fileName, undefined); }
        });
    }

    /**
     * Returns a Document associated with a given file name from VS Code's Memento storage.
     * @param key the file name of a Document
     * @returns the Document associated with the file name, if no Document is found then undefined is returned.
     */
    public getValue(key: string) : Document | undefined {
        // Get the value from VS Code's Memento.
        const value = this.storage.get<string>(key);

        // We need to actually return types since the VS Code API call only returns strings.
        if (value === undefined)
            return undefined;
        else
        {
            // Parse the string returned from storage and return it as a Document object.
            const data = JSON.parse(value);
            return new Document(data.fileName, data.lineCount, data.audioFlagPositions);
        }
    }

    /**
     * Stores a Document with an associated file name into VS Code's Memento storage.
     * @param key the file name of the Document to be stored
     * @param value the Document to be stored into storage. If this parameter is undefined then the Document will be removed from storage.
     */
    public setValue(key: string, value: Document | undefined) {
        if (value === undefined)
            // Removes the document from storage.
            this.storage.update(key, undefined);
        else
            // Uses JSON to convert the Document object into a string and then stores it into VS Codes Memento storage.
            this.storage.update(key, JSON.stringify(value));
    }

    /**
     * Returns an array of file names associated with every Document stored in VS Code's Memento storage.
     * @returns an array of file names
     */
    public getKeys(): readonly string[] {
        return this.storage.keys();
    }
}

/**
 * A class representing an open document. It contains a file name, line count, and an array consisting of audio flag line positions.
 */
class Document {
    fileName: string;
    lineCount: number;
    readonly audioFlagPositions: number[];

    constructor(file: string, lines: number, flags?: number[]) {
        this.fileName = file;
        this.lineCount = lines;
        this.audioFlagPositions = flags ?? [];
    }
}