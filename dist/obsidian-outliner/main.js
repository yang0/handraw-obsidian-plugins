'use strict';

var obsidian = require('obsidian');
var view = require('@codemirror/view');
var language = require('@codemirror/language');
var state = require('@codemirror/state');

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

class MoveCursorToPreviousUnfoldedLine {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const list = this.root.getListUnderCursor();
        const cursor = this.root.getCursor();
        const lines = list.getLinesInfo();
        const lineNo = lines.findIndex((l) => {
            return (cursor.ch === l.from.ch + list.getCheckboxLength() &&
                cursor.line === l.from.line);
        });
        if (lineNo === 0) {
            this.moveCursorToPreviousUnfoldedItem(root, cursor);
        }
        else if (lineNo > 0) {
            this.moveCursorToPreviousNoteLine(root, lines, lineNo);
        }
    }
    moveCursorToPreviousNoteLine(root, lines, lineNo) {
        this.stopPropagation = true;
        this.updated = true;
        root.replaceCursor(lines[lineNo - 1].to);
    }
    moveCursorToPreviousUnfoldedItem(root, cursor) {
        const prev = root.getListUnderLine(cursor.line - 1);
        if (!prev) {
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        if (prev.isFolded()) {
            const foldRoot = prev.getTopFoldRoot();
            const firstLineEnd = foldRoot.getLinesInfo()[0].to;
            root.replaceCursor(firstLineEnd);
        }
        else {
            root.replaceCursor(prev.getLastLineContentEnd());
        }
    }
}

function getEditorFromState(state) {
    const { editor } = state.field(obsidian.editorInfoField);
    if (!editor) {
        return null;
    }
    return new MyEditor(editor);
}
function foldInside(view, from, to) {
    let found = null;
    language.foldedRanges(view.state).between(from, to, (from, to) => {
        if (!found || found.from > from)
            found = { from, to };
    });
    return found;
}
class MyEditor {
    constructor(e) {
        this.e = e;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.view = this.e.cm;
    }
    getCursor() {
        return this.e.getCursor();
    }
    getLine(n) {
        return this.e.getLine(n);
    }
    lastLine() {
        return this.e.lastLine();
    }
    listSelections() {
        return this.e.listSelections();
    }
    getRange(from, to) {
        return this.e.getRange(from, to);
    }
    replaceRange(replacement, from, to) {
        return this.e.replaceRange(replacement, from, to);
    }
    setSelections(selections) {
        this.e.setSelections(selections);
    }
    setValue(text) {
        this.e.setValue(text);
    }
    getValue() {
        return this.e.getValue();
    }
    offsetToPos(offset) {
        return this.e.offsetToPos(offset);
    }
    posToOffset(pos) {
        return this.e.posToOffset(pos);
    }
    fold(n) {
        const { view } = this;
        const l = view.lineBlockAt(view.state.doc.line(n + 1).from);
        const range = language.foldable(view.state, l.from, l.to);
        if (!range || range.from === range.to) {
            return;
        }
        view.dispatch({ effects: [language.foldEffect.of(range)] });
    }
    unfold(n) {
        const { view } = this;
        const l = view.lineBlockAt(view.state.doc.line(n + 1).from);
        const range = foldInside(view, l.from, l.to);
        if (!range) {
            return;
        }
        view.dispatch({ effects: [language.unfoldEffect.of(range)] });
    }
    getAllFoldedLines() {
        const c = language.foldedRanges(this.view.state).iter();
        const res = [];
        while (c.value) {
            res.push(this.offsetToPos(c.from).line);
            c.next();
        }
        return res;
    }
    triggerOnKeyDown(e) {
        view.runScopeHandlers(this.view, e, "editor");
    }
    getZoomRange() {
        if (!window.ObsidianZoomPlugin) {
            return null;
        }
        return window.ObsidianZoomPlugin.getZoomRange(this.e);
    }
    zoomOut() {
        if (!window.ObsidianZoomPlugin) {
            return;
        }
        window.ObsidianZoomPlugin.zoomOut(this.e);
    }
    zoomIn(line) {
        if (!window.ObsidianZoomPlugin) {
            return;
        }
        window.ObsidianZoomPlugin.zoomIn(this.e, line);
    }
    tryRefreshZoom(line) {
        if (!window.ObsidianZoomPlugin) {
            return;
        }
        if (window.ObsidianZoomPlugin.refreshZoom) {
            window.ObsidianZoomPlugin.refreshZoom(this.e);
        }
        else {
            window.ObsidianZoomPlugin.zoomIn(this.e, line);
        }
    }
}

function createKeymapRunCallback(config) {
    const check = config.check || (() => true);
    const { run } = config;
    return (view) => {
        const editor = getEditorFromState(view.state);
        if (!check(editor)) {
            return false;
        }
        const { shouldUpdate, shouldStopPropagation } = run(editor);
        return shouldUpdate || shouldStopPropagation;
    };
}

class ArrowLeftAndCtrlArrowLeftBehaviourOverride {
    constructor(plugin, settings, imeDetector, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return (this.settings.keepCursorWithinContent !== "never" &&
                !this.imeDetector.isOpened());
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new MoveCursorToPreviousUnfoldedLine(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    key: "ArrowLeft",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
                {
                    win: "c-ArrowLeft",
                    linux: "c-ArrowLeft",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

function cmpPos(a, b) {
    return a.line - b.line || a.ch - b.ch;
}
function maxPos(a, b) {
    return cmpPos(a, b) < 0 ? b : a;
}
function minPos(a, b) {
    return cmpPos(a, b) < 0 ? a : b;
}
function isRangesIntersects(a, b) {
    return cmpPos(a[1], b[0]) >= 0 && cmpPos(a[0], b[1]) <= 0;
}
function recalculateNumericBullets(root) {
    function visit(parent) {
        let index = 1;
        for (const child of parent.getChildren()) {
            if (/\d+\./.test(child.getBullet())) {
                child.replateBullet(`${index++}.`);
            }
            visit(child);
        }
    }
    visit(root);
}
let idSeq = 0;
class List {
    constructor(root, indent, bullet, optionalCheckbox, spaceAfterBullet, firstLine, foldRoot) {
        this.root = root;
        this.indent = indent;
        this.bullet = bullet;
        this.optionalCheckbox = optionalCheckbox;
        this.spaceAfterBullet = spaceAfterBullet;
        this.foldRoot = foldRoot;
        this.parent = null;
        this.children = [];
        this.notesIndent = null;
        this.lines = [];
        this.id = idSeq++;
        this.lines.push(firstLine);
    }
    getID() {
        return this.id;
    }
    getNotesIndent() {
        return this.notesIndent;
    }
    setNotesIndent(notesIndent) {
        if (this.notesIndent !== null) {
            throw new Error(`Notes indent already provided`);
        }
        this.notesIndent = notesIndent;
    }
    addLine(text) {
        if (this.notesIndent === null) {
            throw new Error(`Unable to add line, notes indent should be provided first`);
        }
        this.lines.push(text);
    }
    replaceLines(lines) {
        if (lines.length > 1 && this.notesIndent === null) {
            throw new Error(`Unable to add line, notes indent should be provided first`);
        }
        this.lines = lines;
    }
    getLineCount() {
        return this.lines.length;
    }
    getRoot() {
        return this.root;
    }
    getChildren() {
        return this.children.concat();
    }
    getLinesInfo() {
        const startLine = this.root.getContentLinesRangeOf(this)[0];
        return this.lines.map((row, i) => {
            const line = startLine + i;
            const startCh = i === 0 ? this.getContentStartCh() : this.notesIndent.length;
            const endCh = startCh + row.length;
            return {
                text: row,
                from: { line, ch: startCh },
                to: { line, ch: endCh },
            };
        });
    }
    getLines() {
        return this.lines.concat();
    }
    getFirstLineContentStart() {
        const startLine = this.root.getContentLinesRangeOf(this)[0];
        return {
            line: startLine,
            ch: this.getContentStartCh(),
        };
    }
    getFirstLineContentStartAfterCheckbox() {
        const startLine = this.root.getContentLinesRangeOf(this)[0];
        return {
            line: startLine,
            ch: this.getContentStartCh() + this.getCheckboxLength(),
        };
    }
    getLastLineContentEnd() {
        const endLine = this.root.getContentLinesRangeOf(this)[1];
        const endCh = this.lines.length === 1
            ? this.getContentStartCh() + this.lines[0].length
            : this.notesIndent.length + this.lines[this.lines.length - 1].length;
        return {
            line: endLine,
            ch: endCh,
        };
    }
    getContentEndIncludingChildren() {
        return this.getLastChild().getLastLineContentEnd();
    }
    getLastChild() {
        let lastChild = this;
        while (!lastChild.isEmpty()) {
            lastChild = lastChild.getChildren().last();
        }
        return lastChild;
    }
    getContentStartCh() {
        return this.indent.length + this.bullet.length + 1;
    }
    isFolded() {
        if (this.foldRoot) {
            return true;
        }
        if (this.parent) {
            return this.parent.isFolded();
        }
        return false;
    }
    isFoldRoot() {
        return this.foldRoot;
    }
    getTopFoldRoot() {
        let tmp = this;
        let foldRoot = null;
        while (tmp) {
            if (tmp.isFoldRoot()) {
                foldRoot = tmp;
            }
            tmp = tmp.parent;
        }
        return foldRoot;
    }
    getLevel() {
        if (!this.parent) {
            return 0;
        }
        return this.parent.getLevel() + 1;
    }
    unindentContent(from, till) {
        this.indent = this.indent.slice(0, from) + this.indent.slice(till);
        if (this.notesIndent !== null) {
            this.notesIndent =
                this.notesIndent.slice(0, from) + this.notesIndent.slice(till);
        }
        for (const child of this.children) {
            child.unindentContent(from, till);
        }
    }
    indentContent(indentPos, indentChars) {
        this.indent =
            this.indent.slice(0, indentPos) +
                indentChars +
                this.indent.slice(indentPos);
        if (this.notesIndent !== null) {
            this.notesIndent =
                this.notesIndent.slice(0, indentPos) +
                    indentChars +
                    this.notesIndent.slice(indentPos);
        }
        for (const child of this.children) {
            child.indentContent(indentPos, indentChars);
        }
    }
    getFirstLineIndent() {
        return this.indent;
    }
    getBullet() {
        return this.bullet;
    }
    getSpaceAfterBullet() {
        return this.spaceAfterBullet;
    }
    getCheckboxLength() {
        return this.optionalCheckbox.length;
    }
    replateBullet(bullet) {
        this.bullet = bullet;
    }
    getParent() {
        return this.parent;
    }
    addBeforeAll(list) {
        this.children.unshift(list);
        list.parent = this;
    }
    addAfterAll(list) {
        this.children.push(list);
        list.parent = this;
    }
    removeChild(list) {
        const i = this.children.indexOf(list);
        this.children.splice(i, 1);
        list.parent = null;
    }
    addBefore(before, list) {
        const i = this.children.indexOf(before);
        this.children.splice(i, 0, list);
        list.parent = this;
    }
    addAfter(before, list) {
        const i = this.children.indexOf(before);
        this.children.splice(i + 1, 0, list);
        list.parent = this;
    }
    getPrevSiblingOf(list) {
        const i = this.children.indexOf(list);
        return i > 0 ? this.children[i - 1] : null;
    }
    getNextSiblingOf(list) {
        const i = this.children.indexOf(list);
        return i >= 0 && i < this.children.length ? this.children[i + 1] : null;
    }
    isEmpty() {
        return this.children.length === 0;
    }
    print() {
        let res = "";
        for (let i = 0; i < this.lines.length; i++) {
            res +=
                i === 0
                    ? this.indent + this.bullet + this.spaceAfterBullet
                    : this.notesIndent;
            res += this.lines[i];
            res += "\n";
        }
        for (const child of this.children) {
            res += child.print();
        }
        return res;
    }
    clone(newRoot) {
        const clone = new List(newRoot, this.indent, this.bullet, this.optionalCheckbox, this.spaceAfterBullet, "", this.foldRoot);
        clone.id = this.id;
        clone.lines = this.lines.concat();
        clone.notesIndent = this.notesIndent;
        for (const child of this.children) {
            clone.addAfterAll(child.clone(newRoot));
        }
        return clone;
    }
}
class Root {
    constructor(start, end, selections) {
        this.start = start;
        this.end = end;
        this.rootList = new List(this, "", "", "", "", "", false);
        this.selections = [];
        this.replaceSelections(selections);
    }
    getRootList() {
        return this.rootList;
    }
    getContentRange() {
        return [this.getContentStart(), this.getContentEnd()];
    }
    getContentStart() {
        return Object.assign({}, this.start);
    }
    getContentEnd() {
        return Object.assign({}, this.end);
    }
    getSelections() {
        return this.selections.map((s) => ({
            anchor: Object.assign({}, s.anchor),
            head: Object.assign({}, s.head),
        }));
    }
    hasSingleCursor() {
        if (!this.hasSingleSelection()) {
            return false;
        }
        const selection = this.selections[0];
        return (selection.anchor.line === selection.head.line &&
            selection.anchor.ch === selection.head.ch);
    }
    hasSingleSelection() {
        return this.selections.length === 1;
    }
    getSelection() {
        const selection = this.selections[this.selections.length - 1];
        const from = selection.anchor.ch > selection.head.ch
            ? selection.head.ch
            : selection.anchor.ch;
        const to = selection.anchor.ch > selection.head.ch
            ? selection.anchor.ch
            : selection.head.ch;
        return Object.assign(Object.assign({}, selection), { from,
            to });
    }
    getCursor() {
        return Object.assign({}, this.selections[this.selections.length - 1].head);
    }
    replaceCursor(cursor) {
        this.selections = [{ anchor: cursor, head: cursor }];
    }
    replaceSelections(selections) {
        if (selections.length < 1) {
            throw new Error(`Unable to create Root without selections`);
        }
        this.selections = selections;
    }
    getListUnderCursor() {
        return this.getListUnderLine(this.getCursor().line);
    }
    getListUnderLine(line) {
        if (line < this.start.line || line > this.end.line) {
            return;
        }
        let result = null;
        let index = this.start.line;
        const visitArr = (ll) => {
            for (const l of ll) {
                const listFromLine = index;
                const listTillLine = listFromLine + l.getLineCount() - 1;
                if (line >= listFromLine && line <= listTillLine) {
                    result = l;
                }
                else {
                    index = listTillLine + 1;
                    visitArr(l.getChildren());
                }
                if (result !== null) {
                    return;
                }
            }
        };
        visitArr(this.rootList.getChildren());
        return result;
    }
    getContentLinesRangeOf(list) {
        let result = null;
        let line = this.start.line;
        const visitArr = (ll) => {
            for (const l of ll) {
                const listFromLine = line;
                const listTillLine = listFromLine + l.getLineCount() - 1;
                if (l === list) {
                    result = [listFromLine, listTillLine];
                }
                else {
                    line = listTillLine + 1;
                    visitArr(l.getChildren());
                }
                if (result !== null) {
                    return;
                }
            }
        };
        visitArr(this.rootList.getChildren());
        return result;
    }
    getChildren() {
        return this.rootList.getChildren();
    }
    print() {
        let res = "";
        for (const child of this.rootList.getChildren()) {
            res += child.print();
        }
        return res.replace(/\n$/, "");
    }
    clone() {
        const clone = new Root(Object.assign({}, this.start), Object.assign({}, this.end), this.getSelections());
        clone.rootList = this.rootList.clone(clone);
        return clone;
    }
}

class DeleteTillPreviousLineContentEnd {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const list = root.getListUnderCursor();
        const cursor = root.getCursor();
        const lines = list.getLinesInfo();
        const lineNo = lines.findIndex((l) => cursor.ch === l.from.ch && cursor.line === l.from.line);
        if (lineNo === 0) {
            this.mergeWithPreviousItem(root, cursor, list);
        }
        else if (lineNo > 0) {
            this.mergeNotes(root, cursor, list, lines, lineNo);
        }
    }
    mergeNotes(root, cursor, list, lines, lineNo) {
        this.stopPropagation = true;
        this.updated = true;
        const prevLineNo = lineNo - 1;
        root.replaceCursor({
            line: cursor.line - 1,
            ch: lines[prevLineNo].text.length + lines[prevLineNo].from.ch,
        });
        lines[prevLineNo].text += lines[lineNo].text;
        lines.splice(lineNo, 1);
        list.replaceLines(lines.map((l) => l.text));
    }
    mergeWithPreviousItem(root, cursor, list) {
        if (root.getChildren()[0] === list && list.isEmpty()) {
            return;
        }
        this.stopPropagation = true;
        const prev = root.getListUnderLine(cursor.line - 1);
        if (!prev) {
            return;
        }
        const bothAreEmpty = prev.isEmpty() && list.isEmpty();
        const prevIsEmptyAndSameLevel = prev.isEmpty() && !list.isEmpty() && prev.getLevel() === list.getLevel();
        const listIsEmptyAndPrevIsParent = list.isEmpty() && prev.getLevel() === list.getLevel() - 1;
        if (bothAreEmpty || prevIsEmptyAndSameLevel || listIsEmptyAndPrevIsParent) {
            this.updated = true;
            const parent = list.getParent();
            const prevEnd = prev.getLastLineContentEnd();
            if (!prev.getNotesIndent() && list.getNotesIndent()) {
                prev.setNotesIndent(prev.getFirstLineIndent() +
                    list.getNotesIndent().slice(list.getFirstLineIndent().length));
            }
            const oldLines = prev.getLines();
            const newLines = list.getLines();
            oldLines[oldLines.length - 1] += newLines[0];
            const resultLines = oldLines.concat(newLines.slice(1));
            prev.replaceLines(resultLines);
            parent.removeChild(list);
            for (const c of list.getChildren()) {
                list.removeChild(c);
                prev.addAfterAll(c);
            }
            root.replaceCursor(prevEnd);
            recalculateNumericBullets(root);
        }
    }
}

class BackspaceBehaviourOverride {
    constructor(plugin, settings, imeDetector, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return (this.settings.keepCursorWithinContent !== "never" &&
                !this.imeDetector.isOpened());
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new DeleteTillPreviousLineContentEnd(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    key: "Backspace",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

const BETTER_LISTS_BODY_CLASS = "outliner-plugin-better-lists";
class BetterListsStyles {
    constructor(settings, obsidianSettings) {
        this.settings = settings;
        this.obsidianSettings = obsidianSettings;
        this.updateBodyClass = () => {
            const shouldExists = this.obsidianSettings.isDefaultThemeEnabled() &&
                this.settings.betterListsStyles;
            const exists = document.body.classList.contains(BETTER_LISTS_BODY_CLASS);
            if (shouldExists && !exists) {
                document.body.classList.add(BETTER_LISTS_BODY_CLASS);
            }
            if (!shouldExists && exists) {
                document.body.classList.remove(BETTER_LISTS_BODY_CLASS);
            }
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.updateBodyClass();
            this.updateBodyClassInterval = window.setInterval(() => {
                this.updateBodyClass();
            }, 1000);
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            clearInterval(this.updateBodyClassInterval);
            document.body.classList.remove(BETTER_LISTS_BODY_CLASS);
        });
    }
}

class SelectAllContent {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        this.stopPropagation = false;
        this.updated = false;
        const { root } = this;
        if (!root.hasSingleSelection()) {
            return false;
        }
        const { anchor, head } = root.getSelection();
        const from = minPos(anchor, head);
        const to = maxPos(anchor, head);
        const [rootStart, rootEnd] = root.getContentRange();
        if (cmpPos(from, rootStart) < 0 || cmpPos(to, rootEnd) > 0) {
            return false;
        }
        let list = root.getListUnderLine(from.line);
        if (!list) {
            return false;
        }
        const ranges = [
            [
                list.getFirstLineContentStartAfterCheckbox(),
                list.getLastLineContentEnd(),
            ],
        ];
        // Ancestors also cover selections spanning several items. The synthetic
        // root has no List coordinates; its range comes from Root instead.
        while (list && list !== root.getRootList()) {
            ranges.push([
                list.getFirstLineContentStartAfterCheckbox(),
                list.getContentEndIncludingChildren(),
            ]);
            list = list.getParent();
        }
        ranges.push([rootStart, rootEnd]);
        // Skip equal or non-containing ranges, including those that would discard
        // an already selected bullet, indentation or checkbox.
        const nextRange = ranges.find(([start, end]) => cmpPos(start, from) <= 0 &&
            cmpPos(to, end) <= 0 &&
            (cmpPos(start, from) < 0 || cmpPos(to, end) < 0));
        if (!nextRange) {
            return false;
        }
        root.replaceSelections([{ anchor: nextRange[0], head: nextRange[1] }]);
        this.stopPropagation = true;
        this.updated = true;
        return true;
    }
}

class CtrlAAndCmdABehaviourOverride {
    constructor(plugin, settings, imeDetector, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return (this.settings.overrideSelectAllBehaviour && !this.imeDetector.isOpened());
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new SelectAllContent(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    key: "c-a",
                    mac: "m-a",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class DeleteTillNextLineContentStart {
    constructor(root) {
        this.root = root;
        this.deleteTillPreviousLineContentEnd =
            new DeleteTillPreviousLineContentEnd(root);
    }
    shouldStopPropagation() {
        return this.deleteTillPreviousLineContentEnd.shouldStopPropagation();
    }
    shouldUpdate() {
        return this.deleteTillPreviousLineContentEnd.shouldUpdate();
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const list = root.getListUnderCursor();
        const cursor = root.getCursor();
        const lines = list.getLinesInfo();
        const lineNo = lines.findIndex((l) => cursor.ch === l.to.ch && cursor.line === l.to.line);
        if (lineNo === lines.length - 1) {
            const nextLine = lines[lineNo].to.line + 1;
            const nextList = root.getListUnderLine(nextLine);
            if (!nextList) {
                return;
            }
            root.replaceCursor(nextList.getFirstLineContentStart());
            this.deleteTillPreviousLineContentEnd.perform();
        }
        else if (lineNo >= 0) {
            root.replaceCursor(lines[lineNo + 1].from);
            this.deleteTillPreviousLineContentEnd.perform();
        }
    }
}

class DeleteBehaviourOverride {
    constructor(plugin, settings, imeDetector, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return (this.settings.keepCursorWithinContent !== "never" &&
                !this.imeDetector.isOpened());
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new DeleteTillNextLineContentStart(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    key: "Delete",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class MoveListToDifferentPosition {
    constructor(root, listToMove, placeToMove, whereToMove, defaultIndentChars) {
        this.root = root;
        this.listToMove = listToMove;
        this.placeToMove = placeToMove;
        this.whereToMove = whereToMove;
        this.defaultIndentChars = defaultIndentChars;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        if (this.listToMove === this.placeToMove) {
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        const cursorAnchor = this.calculateCursorAnchor();
        this.moveList();
        this.changeIndent();
        this.restoreCursor(cursorAnchor);
        recalculateNumericBullets(this.root);
    }
    calculateCursorAnchor() {
        const cursorLine = this.root.getCursor().line;
        const lines = [
            this.listToMove.getFirstLineContentStart().line,
            this.listToMove.getLastLineContentEnd().line,
            this.placeToMove.getFirstLineContentStart().line,
            this.placeToMove.getLastLineContentEnd().line,
        ];
        const listStartLine = Math.min(...lines);
        const listEndLine = Math.max(...lines);
        if (cursorLine < listStartLine || cursorLine > listEndLine) {
            return null;
        }
        const cursor = this.root.getCursor();
        const cursorList = this.root.getListUnderLine(cursor.line);
        const cursorListStart = cursorList.getFirstLineContentStart();
        const lineDiff = cursor.line - cursorListStart.line;
        const chDiff = cursor.ch - cursorListStart.ch;
        return { cursorList, lineDiff, chDiff };
    }
    moveList() {
        this.listToMove.getParent().removeChild(this.listToMove);
        switch (this.whereToMove) {
            case "before":
                this.placeToMove
                    .getParent()
                    .addBefore(this.placeToMove, this.listToMove);
                break;
            case "after":
                this.placeToMove
                    .getParent()
                    .addAfter(this.placeToMove, this.listToMove);
                break;
            case "inside":
                this.placeToMove.addBeforeAll(this.listToMove);
                break;
        }
    }
    changeIndent() {
        const oldIndent = this.listToMove.getFirstLineIndent();
        const newIndent = this.whereToMove === "inside"
            ? this.placeToMove.getFirstLineIndent() + this.defaultIndentChars
            : this.placeToMove.getFirstLineIndent();
        this.listToMove.unindentContent(0, oldIndent.length);
        this.listToMove.indentContent(0, newIndent);
    }
    restoreCursor(cursorAnchor) {
        if (cursorAnchor) {
            const cursorListStart = cursorAnchor.cursorList.getFirstLineContentStart();
            this.root.replaceCursor({
                line: cursorListStart.line + cursorAnchor.lineDiff,
                ch: cursorListStart.ch + cursorAnchor.chDiff,
            });
        }
        else {
            // When you move a list, the screen scrolls to the cursor.
            // It is better to move the cursor into the viewport than let the screen scroll.
            this.root.replaceCursor(this.listToMove.getLastLineContentEnd());
        }
    }
}

const BODY_CLASS = "outliner-plugin-dnd";
class DragAndDrop {
    constructor(plugin, settings, obisidian, parser, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.obisidian = obisidian;
        this.parser = parser;
        this.operationPerformer = operationPerformer;
        this.contextsByDocument = new Map();
        this.preStart = null;
        this.state = null;
        // Escape cancels the move, but the gesture's release must still not click
        // its handle. Only arm click suppression once that same document gets mouseup.
        this.clickGesture = null;
        this.handleSettingsChange = () => {
            try {
                if (!this.settings.dragAndDrop) {
                    this.cancelDragging();
                }
            }
            finally {
                for (const context of this.contextsByDocument.values()) {
                    this.updateBodyClass(context);
                }
            }
        };
        this.handleMouseDown = (e) => {
            // A new gesture must never overwrite another document's drag owner.
            this.cancelDragging();
            if (!isFeatureSupported() ||
                !this.settings.dragAndDrop ||
                e.button !== 0 ||
                !isClickOnBullet(e)) {
                return;
            }
            const view = getEditorViewFromHTMLElement(e.target);
            if (!view) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            const context = this.getContextByView(view);
            if (!context) {
                return;
            }
            this.preStart = {
                x: e.clientX,
                y: e.clientY,
                view,
                document: context.document,
            };
        };
        this.handleMouseMove = (e) => {
            const eventDocument = getEventDocument(e);
            if ((e.buttons & 1) === 0) {
                this.cancelDragging();
                return;
            }
            if (this.preStart && eventDocument === this.preStart.document) {
                this.startDragging();
            }
            if (this.state && eventDocument === this.state.context.document) {
                this.detectAndDrawDropZone(e.clientX, e.clientY);
            }
        };
        this.handleMouseUp = (e) => {
            var _a;
            this.preStart = null;
            const gesture = this.clickGesture;
            if (e.button === 0 && (gesture === null || gesture === void 0 ? void 0 : gesture.document) === getEventDocument(e)) {
                gesture.released = true;
                // Native click is dispatched with mouseup, before the next timer task.
                // If there is no click, don't leave suppression armed for later input.
                gesture.timeout = (_a = gesture.document.defaultView) === null || _a === void 0 ? void 0 : _a.setTimeout(() => {
                    if (this.clickGesture === gesture) {
                        this.clearClickGesture();
                    }
                }, 0);
            }
            else {
                this.clearClickGesture();
            }
            if (this.state && getEventDocument(e) === this.state.context.document) {
                this.stopDragging();
            }
            else {
                // Releasing in another window cancels; it is not a cross-window drop.
                // An Escape-cancelled gesture still needs its matching click suppressed.
                this.cancelDragging(true);
            }
        };
        this.handleClick = (e) => {
            var _a;
            if (!((_a = this.clickGesture) === null || _a === void 0 ? void 0 : _a.released) ||
                this.clickGesture.document !== getEventDocument(e) ||
                !e.isTrusted ||
                e.button !== 0 ||
                e.detail === 0) {
                return;
            }
            this.clearClickGesture();
            e.preventDefault();
            e.stopImmediatePropagation();
        };
        this.handleKeyDown = (e) => {
            if (e.code === "Escape") {
                this.cancelDragging(true);
            }
        };
        this.handleWindowBlur = (e) => {
            var _a, _b, _c;
            const owner = ((_a = this.state) === null || _a === void 0 ? void 0 : _a.context.document) ||
                ((_b = this.preStart) === null || _b === void 0 ? void 0 : _b.document) ||
                ((_c = this.clickGesture) === null || _c === void 0 ? void 0 : _c.document);
            if ((owner === null || owner === void 0 ? void 0 : owner.defaultView) === e.currentTarget) {
                this.cancelDragging();
            }
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension([
                draggingLinesStateField,
                droppingLinesStateField,
            ]);
            this.plugin.registerEvent(this.plugin.app.workspace.on("window-open", (workspaceWindow, window) => {
                this.registerDocument(workspaceWindow.doc || window.document);
            }));
            this.plugin.registerEvent(this.plugin.app.workspace.on("window-close", (workspaceWindow, window) => {
                this.unregisterDocument(workspaceWindow.doc || window.document);
            }));
            this.registerExistingDocuments();
            this.enableFeatureToggle();
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.cancelDragging();
            }
            finally {
                for (const doc of Array.from(this.contextsByDocument.keys())) {
                    this.unregisterDocument(doc);
                }
                this.disableFeatureToggle();
            }
        });
    }
    enableFeatureToggle() {
        this.settings.onChange(this.handleSettingsChange);
        this.handleSettingsChange();
    }
    disableFeatureToggle() {
        this.settings.removeCallback(this.handleSettingsChange);
    }
    registerExistingDocuments() {
        const docs = new Set();
        docs.add(this.plugin.app.workspace.containerEl.ownerDocument);
        this.plugin.app.workspace.iterateAllLeaves((leaf) => {
            docs.add(leaf.getContainer().doc);
        });
        for (const doc of docs) {
            this.registerDocument(doc);
        }
    }
    registerDocument(doc) {
        var _a;
        if (!doc || this.contextsByDocument.has(doc) || !doc.body) {
            return;
        }
        const dropZonePadding = doc.createElement("div");
        dropZonePadding.classList.add("outliner-plugin-drop-zone-padding");
        const dropZone = doc.createElement("div");
        dropZone.classList.add("outliner-plugin-drop-zone");
        dropZone.style.display = "none";
        dropZone.appendChild(dropZonePadding);
        doc.body.appendChild(dropZone);
        const context = {
            document: doc,
            dropZone,
            dropZonePadding,
        };
        this.contextsByDocument.set(doc, context);
        // Obsidian may copy body classes when creating a new window.
        doc.body.classList.remove("outliner-plugin-dragging");
        this.updateBodyClass(context);
        doc.addEventListener("mousedown", this.handleMouseDown, {
            capture: true,
        });
        doc.addEventListener("click", this.handleClick, { capture: true });
        doc.addEventListener("mousemove", this.handleMouseMove);
        doc.addEventListener("mouseup", this.handleMouseUp, { capture: true });
        doc.addEventListener("keydown", this.handleKeyDown);
        (_a = doc.defaultView) === null || _a === void 0 ? void 0 : _a.addEventListener("blur", this.handleWindowBlur);
    }
    unregisterDocument(doc) {
        var _a, _b, _c, _d;
        if (!doc) {
            return;
        }
        const context = this.contextsByDocument.get(doc);
        if (!context) {
            return;
        }
        try {
            if (((_a = this.preStart) === null || _a === void 0 ? void 0 : _a.document) === doc ||
                ((_b = this.state) === null || _b === void 0 ? void 0 : _b.context.document) === doc ||
                ((_c = this.clickGesture) === null || _c === void 0 ? void 0 : _c.document) === doc) {
                this.cancelDragging();
            }
        }
        finally {
            doc.removeEventListener("mousedown", this.handleMouseDown, {
                capture: true,
            });
            doc.removeEventListener("click", this.handleClick, { capture: true });
            doc.removeEventListener("mousemove", this.handleMouseMove);
            doc.removeEventListener("mouseup", this.handleMouseUp, { capture: true });
            doc.removeEventListener("keydown", this.handleKeyDown);
            (_d = doc.defaultView) === null || _d === void 0 ? void 0 : _d.removeEventListener("blur", this.handleWindowBlur);
            doc.body.classList.remove(BODY_CLASS);
            doc.body.classList.remove("outliner-plugin-dragging");
            context.dropZone.remove();
            this.contextsByDocument.delete(doc);
        }
    }
    getContextByView(view) {
        return this.contextsByDocument.get(view.dom.ownerDocument);
    }
    updateBodyClass(context) {
        if (!isFeatureSupported()) {
            context.document.body.classList.remove(BODY_CLASS);
            return;
        }
        if (this.settings.dragAndDrop) {
            context.document.body.classList.add(BODY_CLASS);
        }
        else {
            context.document.body.classList.remove(BODY_CLASS);
        }
    }
    startDragging() {
        const { x, y, view } = this.preStart;
        this.preStart = null;
        const editor = getEditorFromState(view.state);
        if (!editor) {
            return;
        }
        const dropContext = this.getContextByView(view);
        if (!dropContext) {
            return;
        }
        const posOffset = view.posAtCoords({ x, y });
        if (posOffset === null) {
            return;
        }
        const pos = editor.offsetToPos(posOffset);
        const root = this.parser.parse(editor, pos);
        if (!root) {
            return;
        }
        const list = root.getListUnderLine(pos.line);
        if (!list) {
            return;
        }
        const state = new DragAndDropState(dropContext, view, editor, root, list);
        if (!state.hasDropVariants()) {
            return;
        }
        this.state = state;
        this.clickGesture = { document: dropContext.document, released: false };
        this.highlightDraggingLines();
    }
    detectAndDrawDropZone(x, y) {
        this.state.calculateNearestDropVariant(x, y);
        this.drawDropZone();
    }
    clearClickGesture() {
        var _a, _b;
        if (((_a = this.clickGesture) === null || _a === void 0 ? void 0 : _a.timeout) !== undefined) {
            (_b = this.clickGesture.document.defaultView) === null || _b === void 0 ? void 0 : _b.clearTimeout(this.clickGesture.timeout);
        }
        this.clickGesture = null;
    }
    cancelDragging(preserveClickGesture = false) {
        if (!preserveClickGesture) {
            this.clearClickGesture();
        }
        this.stopDragging(false);
    }
    stopDragging(applyChanges = true) {
        const state = this.state;
        this.preStart = null;
        this.state = null;
        if (!state) {
            return;
        }
        // Release ownership and DOM even if dispatch fails on a closing editor.
        state.context.document.body.classList.remove("outliner-plugin-dragging");
        state.context.dropZone.style.display = "none";
        state.view.dispatch({ effects: [dndEnded.of()] });
        if (applyChanges) {
            this.applyChanges(state);
        }
    }
    applyChanges(state) {
        const { dropVariant, editor, root, list } = state;
        if (!dropVariant) {
            return;
        }
        const newRoot = this.parser.parse(editor, root.getContentStart());
        if (!newRoot || !isSameRoots(root, newRoot)) {
            new obsidian.Notice(`The item cannot be moved. The page content changed during the move.`, 5000);
            return;
        }
        this.operationPerformer.eval(root, new MoveListToDifferentPosition(root, list, dropVariant.placeToMove, dropVariant.whereToMove, this.obisidian.getDefaultIndentChars()), editor);
    }
    highlightDraggingLines() {
        const { state } = this;
        const { list, editor, view } = state;
        const lines = [];
        const fromLine = list.getFirstLineContentStart().line;
        const tillLine = list.getContentEndIncludingChildren().line;
        for (let i = fromLine; i <= tillLine; i++) {
            lines.push(editor.posToOffset({ line: i, ch: 0 }));
        }
        view.dispatch({
            effects: [dndStarted.of(lines)],
        });
        state.context.document.body.classList.add("outliner-plugin-dragging");
    }
    drawDropZone() {
        const { state } = this;
        const { view, editor, dropVariant } = state;
        const { dropZone, dropZonePadding, document } = state.context;
        const newParent = dropVariant.whereToMove === "inside"
            ? dropVariant.placeToMove
            : dropVariant.placeToMove.getParent();
        const newParentIsRootList = !newParent.getParent();
        {
            const width = Math.round(view.contentDOM.offsetWidth -
                (dropVariant.left - this.state.leftPadding));
            dropZone.style.display = "block";
            dropZone.style.top = dropVariant.top + "px";
            dropZone.style.left = dropVariant.left + "px";
            dropZone.style.width = width + "px";
        }
        {
            const level = newParent.getLevel();
            const indentWidth = this.state.tabWidth;
            const width = indentWidth * level;
            const dashPadding = 3;
            const dashWidth = indentWidth - dashPadding;
            const color = getComputedStyle(document.body).getPropertyValue("--color-accent");
            dropZonePadding.style.width = `${width}px`;
            dropZonePadding.style.marginLeft = `-${width}px`;
            dropZonePadding.style.backgroundImage = `url('data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20${width}%204%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cline%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%22${width}%22%20y2%3D%220%22%20stroke%3D%22${color}%22%20stroke-width%3D%228%22%20stroke-dasharray%3D%22${dashWidth}%20${dashPadding}%22%2F%3E%3C%2Fsvg%3E')`;
        }
        this.state.view.dispatch({
            effects: [
                dndMoved.of(newParentIsRootList
                    ? null
                    : editor.posToOffset({
                        line: newParent.getFirstLineContentStart().line,
                        ch: 0,
                    })),
            ],
        });
    }
}
class DragAndDropState {
    constructor(context, view, editor, root, list) {
        this.context = context;
        this.view = view;
        this.editor = editor;
        this.root = root;
        this.list = list;
        this.dropVariants = new Map();
        this.dropVariant = null;
        this.leftPadding = 0;
        this.tabWidth = 0;
        this.collectDropVariants();
        this.calculateLeftPadding();
        this.calculateTabWidth();
    }
    getDropVariants() {
        return Array.from(this.dropVariants.values());
    }
    hasDropVariants() {
        return this.dropVariants.size > 0;
    }
    calculateNearestDropVariant(x, y) {
        const { view, editor } = this;
        const dropVariants = this.getDropVariants();
        const possibleDropVariants = [];
        for (const v of dropVariants) {
            const { placeToMove } = v;
            const positionAfterList = v.whereToMove === "after" || v.whereToMove === "inside";
            const line = positionAfterList
                ? placeToMove.getContentEndIncludingChildren().line
                : placeToMove.getFirstLineContentStart().line;
            const linePos = editor.posToOffset({
                line,
                ch: 0,
            });
            const coords = view.coordsAtPos(linePos, -1);
            if (!coords) {
                continue;
            }
            v.left = this.leftPadding + (v.level - 1) * this.tabWidth;
            v.top = coords.top;
            if (positionAfterList) {
                v.top += view.lineBlockAt(linePos).height;
            }
            // Better vertical alignment
            v.top -= 8;
            possibleDropVariants.push(v);
        }
        const nearestLineTop = possibleDropVariants
            .sort((a, b) => Math.abs(y - a.top) - Math.abs(y - b.top))
            .first().top;
        const variansOnNearestLine = possibleDropVariants.filter((v) => Math.abs(v.top - nearestLineTop) <= 4);
        this.dropVariant = variansOnNearestLine
            .sort((a, b) => Math.abs(x - a.left) - Math.abs(x - b.left))
            .first();
    }
    addDropVariant(v) {
        this.dropVariants.set(`${v.line} ${v.level}`, v);
    }
    collectDropVariants() {
        const visit = (lists) => {
            for (const placeToMove of lists) {
                const lineBefore = placeToMove.getFirstLineContentStart().line;
                const lineAfter = placeToMove.getContentEndIncludingChildren().line + 1;
                const level = placeToMove.getLevel();
                this.addDropVariant({
                    line: lineBefore,
                    level,
                    left: 0,
                    top: 0,
                    placeToMove,
                    whereToMove: "before",
                });
                this.addDropVariant({
                    line: lineAfter,
                    level,
                    left: 0,
                    top: 0,
                    placeToMove,
                    whereToMove: "after",
                });
                if (placeToMove === this.list) {
                    continue;
                }
                if (placeToMove.isEmpty()) {
                    this.addDropVariant({
                        line: lineAfter,
                        level: level + 1,
                        left: 0,
                        top: 0,
                        placeToMove,
                        whereToMove: "inside",
                    });
                }
                else {
                    visit(placeToMove.getChildren());
                }
            }
        };
        visit(this.root.getChildren());
    }
    calculateLeftPadding() {
        const cmLine = this.view.dom.querySelector("div.cm-line");
        this.leftPadding = cmLine.getBoundingClientRect().left;
    }
    calculateTabWidth() {
        const { view } = this;
        const indentDom = view.dom.querySelector(".cm-indent");
        if (indentDom) {
            this.tabWidth = indentDom.offsetWidth;
            return;
        }
        const singleIndent = language.indentString(view.state, language.getIndentUnit(view.state));
        for (let i = 1; i <= view.state.doc.lines; i++) {
            const line = view.state.doc.line(i);
            if (line.text.startsWith(singleIndent)) {
                const a = view.coordsAtPos(line.from, -1);
                if (!a) {
                    continue;
                }
                const b = view.coordsAtPos(line.from + singleIndent.length, -1);
                if (!b) {
                    continue;
                }
                this.tabWidth = b.left - a.left;
                return;
            }
        }
        this.tabWidth = view.defaultCharacterWidth * language.getIndentUnit(view.state);
    }
}
const dndStarted = state.StateEffect.define({
    map: (lines, change) => lines.map((l) => change.mapPos(l)),
});
const dndMoved = state.StateEffect.define({
    map: (line, change) => (line !== null ? change.mapPos(line) : line),
});
const dndEnded = state.StateEffect.define();
const draggingLineDecoration = view.Decoration.line({
    class: "outliner-plugin-dragging-line",
});
const droppingLineDecoration = view.Decoration.line({
    class: "outliner-plugin-dropping-line",
});
const draggingLinesStateField = state.StateField.define({
    create: () => view.Decoration.none,
    update: (dndState, tr) => {
        dndState = dndState.map(tr.changes);
        for (const e of tr.effects) {
            if (e.is(dndStarted)) {
                dndState = dndState.update({
                    add: e.value.map((l) => draggingLineDecoration.range(l, l)),
                });
            }
            if (e.is(dndEnded)) {
                dndState = view.Decoration.none;
            }
        }
        return dndState;
    },
    provide: (f) => view.EditorView.decorations.from(f),
});
const droppingLinesStateField = state.StateField.define({
    create: () => view.Decoration.none,
    update: (dndDroppingState, tr) => {
        dndDroppingState = dndDroppingState.map(tr.changes);
        for (const e of tr.effects) {
            if (e.is(dndMoved)) {
                dndDroppingState =
                    e.value === null
                        ? view.Decoration.none
                        : view.Decoration.set(droppingLineDecoration.range(e.value, e.value));
            }
            if (e.is(dndEnded)) {
                dndDroppingState = view.Decoration.none;
            }
        }
        return dndDroppingState;
    },
    provide: (f) => view.EditorView.decorations.from(f),
});
function getEditorViewFromHTMLElement(e) {
    while (e && !e.classList.contains("cm-editor")) {
        e = e.parentElement;
    }
    if (!e) {
        return null;
    }
    return view.EditorView.findFromDOM(e);
}
function isClickOnBullet(e) {
    let el = e.target;
    while (el) {
        if (el.classList.contains("cm-formatting-list") ||
            el.classList.contains("cm-fold-indicator") ||
            el.classList.contains("task-list-item-checkbox") ||
            el.hasAttribute("data-outliner-drag-handle")) {
            return true;
        }
        el = el.parentElement;
    }
    return false;
}
function getEventDocument(e) {
    const target = e.target;
    if (!target || typeof target !== "object") {
        return null;
    }
    const maybeNode = target;
    if (maybeNode.nodeType === 9) {
        return target;
    }
    if ("ownerDocument" in maybeNode) {
        return maybeNode.ownerDocument || null;
    }
    return null;
}
function isSameRoots(a, b) {
    const [aStart, aEnd] = a.getContentRange();
    const [bStart, bEnd] = b.getContentRange();
    if (cmpPos(aStart, bStart) !== 0 || cmpPos(aEnd, bEnd) !== 0) {
        return false;
    }
    return a.print() === b.print();
}
function isFeatureSupported() {
    return obsidian.Platform.isDesktop;
}

class ExpandSelectionToFullItems {
    constructor(root) {
        this.root = root;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.updated;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        this.updated = false;
        const { root } = this;
        if (!root.hasSingleSelection()) {
            return;
        }
        const { anchor, head } = root.getSelection();
        const from = minPos(anchor, head);
        const to = maxPos(anchor, head);
        const [rootStart, rootEnd] = root.getContentRange();
        if (cmpPos(from, rootStart) < 0 || cmpPos(to, rootEnd) > 0) {
            return;
        }
        // Selection ranges are half-open: column zero does not select that item.
        const lastSelectedLine = to.ch === 0 ? to.line - 1 : to.line;
        if (lastSelectedLine <= from.line) {
            return;
        }
        const first = root.getListUnderLine(from.line);
        const last = root.getListUnderLine(lastSelectedLine);
        if (!first || !last || first === last) {
            return;
        }
        const expandedStart = minPos(from, first.getFirstLineContentStartAfterCheckbox());
        let expandedEnd = maxPos(to, first.getContentEndIncludingChildren());
        // Any intervening item whose subtree extends past the last selected item
        // must be its ancestor. Include it only if its own content was touched.
        for (let item = last; item && item !== root.getRootList(); item = item.getParent()) {
            if (item.getLastLineContentEnd().line < from.line) {
                break;
            }
            expandedEnd = maxPos(expandedEnd, item.getContentEndIncludingChildren());
        }
        if (cmpPos(from, expandedStart) === 0 && cmpPos(to, expandedEnd) === 0) {
            return;
        }
        const forward = cmpPos(anchor, head) <= 0;
        root.replaceSelections([
            forward
                ? { anchor: expandedStart, head: expandedEnd }
                : { anchor: expandedEnd, head: expandedStart },
        ]);
        this.updated = true;
    }
}

class KeepCursorOutsideFoldedLines {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const cursor = root.getCursor();
        const list = root.getListUnderCursor();
        if (!list.isFolded()) {
            return;
        }
        const foldRoot = list.getTopFoldRoot();
        const firstLineEnd = foldRoot.getLinesInfo()[0].to;
        if (cursor.line > firstLineEnd.line) {
            this.updated = true;
            this.stopPropagation = true;
            root.replaceCursor(firstLineEnd);
        }
    }
}

class KeepCursorWithinListContent {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const cursor = root.getCursor();
        const list = root.getListUnderCursor();
        const contentStart = list.getFirstLineContentStartAfterCheckbox();
        const linePrefix = contentStart.line === cursor.line
            ? contentStart.ch
            : list.getNotesIndent().length;
        if (cursor.ch < linePrefix) {
            this.updated = true;
            this.stopPropagation = true;
            root.replaceCursor({
                line: cursor.line,
                ch: linePrefix,
            });
        }
    }
}

class EditorSelectionsBehaviourOverride {
    constructor(plugin, settings, parser, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.parser = parser;
        this.operationPerformer = operationPerformer;
        this.transactionExtender = (tr) => {
            if (!tr.selection ||
                (!this.settings.expandSelection &&
                    this.settings.keepCursorWithinContent === "never")) {
                return null;
            }
            const editor = getEditorFromState(tr.startState);
            setTimeout(() => {
                this.handleSelectionsChanges(editor);
            }, 0);
            return null;
        };
        this.handleSelectionsChanges = (editor) => {
            const root = this.parser.parse(editor);
            if (!root) {
                return;
            }
            if (this.settings.expandSelection) {
                const { shouldStopPropagation } = this.operationPerformer.eval(root, new ExpandSelectionToFullItems(root), editor);
                if (shouldStopPropagation) {
                    return;
                }
            }
            if (this.settings.keepCursorWithinContent === "never") {
                return;
            }
            {
                const { shouldStopPropagation } = this.operationPerformer.eval(root, new KeepCursorOutsideFoldedLines(root), editor);
                if (shouldStopPropagation) {
                    return;
                }
            }
            this.operationPerformer.eval(root, new KeepCursorWithinListContent(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(state.EditorState.transactionExtender.of(this.transactionExtender));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

const checkboxRe = `\\[[^\\[\\]]\\][ \t]`;

function isEmptyLineOrEmptyCheckbox(line) {
    return line === "" || line === "[ ] ";
}

class CreateNewItem {
    constructor(root, defaultIndentChars, getZoomRange, after = true, shouldOutdentEmptyLines = true) {
        this.root = root;
        this.defaultIndentChars = defaultIndentChars;
        this.getZoomRange = getZoomRange;
        this.after = after;
        this.shouldOutdentEmptyLines = shouldOutdentEmptyLines;
        this.stopPropagation = false;
        this.updated = false;
        this.skippedInsideCodeblock = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    wasSkippedInsideCodeblock() {
        return this.skippedInsideCodeblock;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleSelection()) {
            return;
        }
        const selection = root.getSelection();
        if (!selection || selection.anchor.line !== selection.head.line) {
            return;
        }
        const list = root.getListUnderCursor();
        const lines = list.getLinesInfo();
        // Only skip creation of new items for empty lines if outdenting is enabled
        // When outdenting is disabled, we want to create new items for empty lines
        if (lines.length === 1 &&
            isEmptyLineOrEmptyCheckbox(lines[0].text) &&
            this.shouldOutdentEmptyLines) {
            return;
        }
        const cursor = root.getCursor();
        const lineUnderCursor = lines.find((l) => l.from.line === cursor.line);
        if (cursor.ch < lineUnderCursor.from.ch) {
            return;
        }
        const { oldLines, newLines } = lines.reduce((acc, line) => {
            if (cursor.line > line.from.line) {
                acc.oldLines.push(line.text);
            }
            else if (cursor.line === line.from.line) {
                const left = line.text.slice(0, selection.from - line.from.ch);
                const right = line.text.slice(selection.to - line.from.ch);
                acc.oldLines.push(left);
                acc.newLines.push(right);
            }
            else if (cursor.line < line.from.line) {
                acc.newLines.push(line.text);
            }
            return acc;
        }, {
            oldLines: [],
            newLines: [],
        });
        const codeBlockBacticks = oldLines.join("\n").split("```").length - 1;
        const isInsideCodeblock = codeBlockBacticks > 0 && codeBlockBacticks % 2 !== 0;
        if (isInsideCodeblock) {
            this.skippedInsideCodeblock = true;
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        const zoomRange = this.getZoomRange.getZoomRange();
        const listIsZoomingRoot = Boolean(zoomRange &&
            list.getFirstLineContentStart().line >= zoomRange.from.line &&
            list.getLastLineContentEnd().line <= zoomRange.from.line);
        const hasChildren = !list.isEmpty();
        const childIsFolded = list.isFoldRoot();
        const endPos = list.getLastLineContentEnd();
        const endOfLine = cursor.line === endPos.line && cursor.ch === endPos.ch;
        const onChildLevel = this.after &&
            (listIsZoomingRoot || (hasChildren && !childIsFolded && endOfLine));
        const indent = onChildLevel
            ? hasChildren
                ? list.getChildren()[0].getFirstLineIndent()
                : list.getFirstLineIndent() + this.defaultIndentChars
            : list.getFirstLineIndent();
        const bullet = onChildLevel && hasChildren
            ? list.getChildren()[0].getBullet()
            : list.getBullet();
        const spaceAfterBullet = onChildLevel && hasChildren
            ? list.getChildren()[0].getSpaceAfterBullet()
            : list.getSpaceAfterBullet();
        const prefix = oldLines[0].match(checkboxRe) ? "[ ] " : "";
        const newList = new List(list.getRoot(), indent, bullet, prefix, spaceAfterBullet, prefix + newLines.shift(), false);
        if (newLines.length > 0) {
            newList.setNotesIndent(list.getNotesIndent());
            for (const line of newLines) {
                newList.addLine(line);
            }
        }
        if (onChildLevel) {
            list.addBeforeAll(newList);
        }
        else {
            if (this.after && (!childIsFolded || !endOfLine)) {
                const children = list.getChildren();
                for (const child of children) {
                    list.removeChild(child);
                    newList.addAfterAll(child);
                }
            }
            if (this.after) {
                list.getParent().addAfter(list, newList);
            }
            else {
                list.getParent().addBefore(list, newList);
            }
        }
        list.replaceLines(oldLines);
        const newListStart = newList.getFirstLineContentStart();
        root.replaceCursor({
            line: newListStart.line,
            ch: newListStart.ch + prefix.length,
        });
        recalculateNumericBullets(root);
    }
}

class OutdentList {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const list = root.getListUnderCursor();
        const parent = list.getParent();
        const grandParent = parent.getParent();
        if (!grandParent) {
            return;
        }
        this.updated = true;
        const listStartLineBefore = root.getContentLinesRangeOf(list)[0];
        const indentRmFrom = parent.getFirstLineIndent().length;
        const indentRmTill = list.getFirstLineIndent().length;
        parent.removeChild(list);
        grandParent.addAfter(parent, list);
        list.unindentContent(indentRmFrom, indentRmTill);
        const listStartLineAfter = root.getContentLinesRangeOf(list)[0];
        const lineDiff = listStartLineAfter - listStartLineBefore;
        const chDiff = indentRmTill - indentRmFrom;
        const cursor = root.getCursor();
        root.replaceCursor({
            line: cursor.line + lineDiff,
            ch: cursor.ch - chDiff,
        });
        recalculateNumericBullets(root);
    }
}

class OutdentListIfItsEmpty {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
        this.outdentList = new OutdentList(root);
    }
    shouldStopPropagation() {
        return this.stopPropagation || this.outdentList.shouldStopPropagation();
    }
    shouldUpdate() {
        return this.updated || this.outdentList.shouldUpdate();
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const list = root.getListUnderCursor();
        const lines = list.getLines();
        if (lines.length > 1 || !isEmptyLineOrEmptyCheckbox(lines[0])) {
            return;
        }
        if (list.getLevel() === 1) {
            this.deleteListIfItIsTheLastAndHasNoChildren(list);
            return;
        }
        this.outdentList.perform();
    }
    deleteListIfItIsTheLastAndHasNoChildren(list) {
        const { root } = this;
        const parent = list.getParent();
        const siblings = parent.getChildren();
        const cursor = root.getCursor();
        if (!list.isEmpty() ||
            siblings[siblings.length - 1] !== list ||
            cursor.ch !== list.getLastLineContentEnd().ch) {
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        parent.removeChild(list);
        // Closing the list leaves an empty line behind. Root.print() strips
        // a single trailing newline, so an empty list item is needed to
        // represent that remaining empty line in the model.
        parent.addAfterAll(new List(root, "", "", "", "", "", false));
        root.replaceCursor({ line: cursor.line, ch: 0 });
    }
}

class EnterBehaviourOverride {
    constructor(plugin, settings, imeDetector, obsidianSettings, parser, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.obsidianSettings = obsidianSettings;
        this.parser = parser;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return this.settings.overrideEnterBehaviour && !this.imeDetector.isOpened();
        };
        this.run = (editor) => {
            const root = this.parser.parse(editor);
            if (!root) {
                return {
                    shouldUpdate: false,
                    shouldStopPropagation: false,
                };
            }
            if (this.settings.enterOutdentsEmptyListItem) {
                const res = this.operationPerformer.eval(root, new OutdentListIfItsEmpty(root), editor);
                if (res.shouldStopPropagation) {
                    return res;
                }
            }
            {
                const defaultIndentChars = this.obsidianSettings.getDefaultIndentChars();
                const zoomRange = editor.getZoomRange();
                const getZoomRange = {
                    getZoomRange: () => zoomRange,
                };
                const res = this.operationPerformer.eval(root, new CreateNewItem(root, defaultIndentChars, getZoomRange, true, this.settings.enterOutdentsEmptyListItem), editor);
                if (res.shouldUpdate && zoomRange) {
                    editor.tryRefreshZoom(zoomRange.from.line);
                }
                return res;
            }
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(state.Prec.highest(view.keymap.of([
                {
                    key: "Enter",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ])));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

function createEditorCallback(cb) {
    return (editor) => {
        const myEditor = new MyEditor(editor);
        const shouldStopPropagation = cb(myEditor);
        if (!shouldStopPropagation &&
            window.event &&
            window.event.type === "keydown") {
            myEditor.triggerOnKeyDown(window.event);
        }
    };
}

class ListsFoldingCommands {
    constructor(plugin, obsidianSettings) {
        this.plugin = plugin;
        this.obsidianSettings = obsidianSettings;
        this.fold = (editor) => {
            return this.setFold(editor, "fold");
        };
        this.unfold = (editor) => {
            return this.setFold(editor, "unfold");
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.addCommand({
                id: "fold",
                icon: "chevrons-down-up",
                name: "Fold the list",
                editorCallback: createEditorCallback(this.fold),
                hotkeys: [
                    {
                        modifiers: ["Mod"],
                        key: "ArrowUp",
                    },
                ],
            });
            this.plugin.addCommand({
                id: "unfold",
                icon: "chevrons-up-down",
                name: "Unfold the list",
                editorCallback: createEditorCallback(this.unfold),
                hotkeys: [
                    {
                        modifiers: ["Mod"],
                        key: "ArrowDown",
                    },
                ],
            });
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    setFold(editor, type) {
        if (!this.obsidianSettings.getFoldSettings().foldIndent) {
            new obsidian.Notice(`Unable to ${type} because folding is disabled. Please enable "Fold indent" in Obsidian settings.`, 5000);
            return true;
        }
        const cursor = editor.getCursor();
        if (type === "fold") {
            editor.fold(cursor.line);
        }
        else {
            editor.unfold(cursor.line);
        }
        return true;
    }
}

class IndentList {
    constructor(root, defaultIndentChars) {
        this.root = root;
        this.defaultIndentChars = defaultIndentChars;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const list = root.getListUnderCursor();
        const parent = list.getParent();
        const prev = parent.getPrevSiblingOf(list);
        if (!prev) {
            return;
        }
        this.updated = true;
        const listStartLineBefore = root.getContentLinesRangeOf(list)[0];
        const indentPos = list.getFirstLineIndent().length;
        let indentChars = "";
        if (indentChars === "" && !prev.isEmpty()) {
            indentChars = prev
                .getChildren()[0]
                .getFirstLineIndent()
                .slice(prev.getFirstLineIndent().length);
        }
        if (indentChars === "") {
            indentChars = list
                .getFirstLineIndent()
                .slice(parent.getFirstLineIndent().length);
        }
        if (indentChars === "" && !list.isEmpty()) {
            indentChars = list.getChildren()[0].getFirstLineIndent();
        }
        if (indentChars === "") {
            indentChars = this.defaultIndentChars;
        }
        parent.removeChild(list);
        prev.addAfterAll(list);
        list.indentContent(indentPos, indentChars);
        const listStartLineAfter = root.getContentLinesRangeOf(list)[0];
        const lineDiff = listStartLineAfter - listStartLineBefore;
        const cursor = root.getCursor();
        root.replaceCursor({
            line: cursor.line + lineDiff,
            ch: cursor.ch + indentChars.length,
        });
        recalculateNumericBullets(root);
    }
}

class MoveListDown {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        var _a, _b;
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const list = root.getListUnderCursor();
        const parent = list.getParent();
        const grandParent = parent.getParent();
        const next = parent.getNextSiblingOf(list);
        const listStartLineBefore = root.getContentLinesRangeOf(list)[0];
        let indentDiff = 0;
        if (!next && grandParent) {
            const newParent = grandParent.getNextSiblingOf(parent);
            if (newParent) {
                const oldIndent = list.getFirstLineIndent();
                const newIndent = (_b = (_a = newParent.getChildren()[0]) === null || _a === void 0 ? void 0 : _a.getFirstLineIndent()) !== null && _b !== void 0 ? _b : newParent.getFirstLineIndent() +
                    oldIndent.slice(parent.getFirstLineIndent().length);
                this.updated = true;
                parent.removeChild(list);
                newParent.addBeforeAll(list);
                list.unindentContent(0, oldIndent.length);
                list.indentContent(0, newIndent);
                indentDiff = newIndent.length - oldIndent.length;
            }
        }
        else if (next) {
            this.updated = true;
            parent.removeChild(list);
            parent.addAfter(next, list);
        }
        if (!this.updated) {
            return;
        }
        const listStartLineAfter = root.getContentLinesRangeOf(list)[0];
        const lineDiff = listStartLineAfter - listStartLineBefore;
        const cursor = root.getCursor();
        root.replaceCursor({
            line: cursor.line + lineDiff,
            ch: cursor.ch + indentDiff,
        });
        recalculateNumericBullets(root);
    }
}

class MoveListUp {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        var _a, _b;
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const list = root.getListUnderCursor();
        const parent = list.getParent();
        const grandParent = parent.getParent();
        const prev = parent.getPrevSiblingOf(list);
        const listStartLineBefore = root.getContentLinesRangeOf(list)[0];
        let indentDiff = 0;
        if (!prev && grandParent) {
            const newParent = grandParent.getPrevSiblingOf(parent);
            if (newParent) {
                const oldIndent = list.getFirstLineIndent();
                const newIndent = (_b = (_a = newParent.getChildren().last()) === null || _a === void 0 ? void 0 : _a.getFirstLineIndent()) !== null && _b !== void 0 ? _b : newParent.getFirstLineIndent() +
                    oldIndent.slice(parent.getFirstLineIndent().length);
                this.updated = true;
                parent.removeChild(list);
                newParent.addAfterAll(list);
                list.unindentContent(0, oldIndent.length);
                list.indentContent(0, newIndent);
                indentDiff = newIndent.length - oldIndent.length;
            }
        }
        else if (prev) {
            this.updated = true;
            parent.removeChild(list);
            parent.addBefore(prev, list);
        }
        if (!this.updated) {
            return;
        }
        const listStartLineAfter = root.getContentLinesRangeOf(list)[0];
        const lineDiff = listStartLineAfter - listStartLineBefore;
        const cursor = root.getCursor();
        root.replaceCursor({
            line: cursor.line + lineDiff,
            ch: cursor.ch + indentDiff,
        });
        recalculateNumericBullets(root);
    }
}

class ListsMovementCommands {
    constructor(plugin, obsidianSettings, operationPerformer) {
        this.plugin = plugin;
        this.obsidianSettings = obsidianSettings;
        this.operationPerformer = operationPerformer;
        this.moveListDown = (editor) => {
            const { shouldStopPropagation } = this.operationPerformer.perform((root) => new MoveListDown(root), editor);
            return shouldStopPropagation;
        };
        this.moveListUp = (editor) => {
            const { shouldStopPropagation } = this.operationPerformer.perform((root) => new MoveListUp(root), editor);
            return shouldStopPropagation;
        };
        this.indentList = (editor) => {
            const { shouldStopPropagation } = this.operationPerformer.perform((root) => new IndentList(root, this.obsidianSettings.getDefaultIndentChars()), editor);
            return shouldStopPropagation;
        };
        this.outdentList = (editor) => {
            const { shouldStopPropagation } = this.operationPerformer.perform((root) => new OutdentList(root), editor);
            return shouldStopPropagation;
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.addCommand({
                id: "move-list-item-up",
                icon: "arrow-up",
                name: "Move list and sublists up",
                editorCallback: createEditorCallback(this.moveListUp),
                hotkeys: [
                    {
                        modifiers: ["Mod", "Shift"],
                        key: "ArrowUp",
                    },
                ],
            });
            this.plugin.addCommand({
                id: "move-list-item-down",
                icon: "arrow-down",
                name: "Move list and sublists down",
                editorCallback: createEditorCallback(this.moveListDown),
                hotkeys: [
                    {
                        modifiers: ["Mod", "Shift"],
                        key: "ArrowDown",
                    },
                ],
            });
            this.plugin.addCommand({
                id: "indent-list",
                icon: "indent",
                name: "Indent the list and sublists",
                editorCallback: createEditorCallback(this.indentList),
                hotkeys: [],
            });
            this.plugin.addCommand({
                id: "outdent-list",
                icon: "outdent",
                name: "Outdent the list and sublists",
                editorCallback: createEditorCallback(this.outdentList),
                hotkeys: [],
            });
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class DeleteTillCurrentLineContentStart {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        const cursor = root.getCursor();
        const list = root.getListUnderCursor();
        const lines = list.getLinesInfo();
        const lineNo = lines.findIndex((l) => l.from.line === cursor.line);
        lines[lineNo].text = lines[lineNo].text.slice(cursor.ch - lines[lineNo].from.ch);
        list.replaceLines(lines.map((l) => l.text));
        root.replaceCursor(lines[lineNo].from);
    }
}

class MetaBackspaceBehaviourOverride {
    constructor(plugin, settings, imeDetector, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return (this.settings.keepCursorWithinContent !== "never" &&
                !this.imeDetector.isOpened());
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new DeleteTillCurrentLineContentStart(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    mac: "m-Backspace",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class ObsidianOutlinerPluginSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin, settings) {
        super(app, plugin);
        this.settings = settings;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        new obsidian.Setting(containerEl)
            .setName("Stick the cursor to the content")
            .setDesc("Don't let the cursor move to the bullet position.")
            .addDropdown((dropdown) => {
            dropdown
                .addOptions({
                never: "Never",
                "bullet-only": "Stick cursor out of bullets",
                "bullet-and-checkbox": "Stick cursor out of bullets and checkboxes",
            })
                .setValue(this.settings.keepCursorWithinContent)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.keepCursorWithinContent = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Enhance the Tab key")
            .setDesc("Make Tab and Shift-Tab behave the same as other outliners.")
            .addToggle((toggle) => {
            toggle
                .setValue(this.settings.overrideTabBehaviour)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.overrideTabBehaviour = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Enhance the Enter key")
            .setDesc("Make the Enter key behave the same as other outliners.")
            .addToggle((toggle) => {
            toggle
                .setValue(this.settings.overrideEnterBehaviour)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.overrideEnterBehaviour = value;
                yield this.settings.save();
                this.display(); // Refresh to show/hide the outdent setting
            }));
        });
        // Only show the outdent setting if Enter enhancement is enabled
        if (this.settings.overrideEnterBehaviour) {
            new obsidian.Setting(containerEl)
                .setName("Outdent empty items with Enter")
                .setDesc("When enabled, Enter outdents empty items or exits the list at the top level. When disabled, Enter keeps empty bullets and checkboxes and continues the list.")
                .addToggle((toggle) => {
                toggle
                    .setValue(this.settings.enterOutdentsEmptyListItem)
                    .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                    this.settings.enterOutdentsEmptyListItem = value;
                    yield this.settings.save();
                }));
            });
        }
        new obsidian.Setting(containerEl)
            .setName("Vim-mode o/O inserts bullets")
            .setDesc("Create a bullet when pressing o or O in Vim mode.")
            .addToggle((toggle) => {
            toggle
                .setValue(this.settings.overrideVimOBehaviour)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.overrideVimOBehaviour = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Enhance the Ctrl+A or Cmd+A behavior")
            .setDesc("Press the hotkey once to select the current list item. Press the hotkey twice to select the entire list.")
            .addToggle((toggle) => {
            toggle
                .setValue(this.settings.overrideSelectAllBehaviour)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.overrideSelectAllBehaviour = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Auto-expand selection to full list items")
            .setDesc("When selecting across multiple list items, include their full content and children. Selections within one item stay unchanged.")
            .addToggle((toggle) => {
            toggle
                .setValue(this.settings.expandSelection)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.expandSelection = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Improve the style of your lists")
            .setDesc("Styles are only compatible with built-in Obsidian themes and may not be compatible with other themes.")
            .addToggle((toggle) => {
            toggle
                .setValue(this.settings.betterListsStyles)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.betterListsStyles = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Draw vertical indentation lines")
            .addToggle((toggle) => {
            toggle.setValue(this.settings.verticalLines).onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.verticalLines = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Vertical indentation line click action")
            .addDropdown((dropdown) => {
            dropdown
                .addOptions({
                none: "None",
                "zoom-in": "Zoom In",
                "toggle-folding": "Toggle Folding",
            })
                .setValue(this.settings.verticalLinesAction)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.verticalLinesAction = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl).setName("Drag-and-Drop").addToggle((toggle) => {
            toggle.setValue(this.settings.dragAndDrop).onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.dragAndDrop = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Debug mode")
            .setDesc("Open DevTools (Command+Option+I or Control+Shift+I) to copy the debug logs.")
            .addToggle((toggle) => {
            toggle.setValue(this.settings.debug).onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.debug = value;
                yield this.settings.save();
            }));
        });
    }
}
class SettingsTab {
    constructor(plugin, settings) {
        this.plugin = plugin;
        this.settings = settings;
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.addSettingTab(new ObsidianOutlinerPluginSettingTab(this.plugin.app, this.plugin, this.settings));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class ShiftTabBehaviourOverride {
    constructor(plugin, imeDetector, settings, operationPerformer) {
        this.plugin = plugin;
        this.imeDetector = imeDetector;
        this.settings = settings;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return this.settings.overrideTabBehaviour && !this.imeDetector.isOpened();
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new OutdentList(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(state.Prec.highest(view.keymap.of([
                {
                    key: "s-Tab",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ])));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class SystemInfoModal extends obsidian.Modal {
    constructor(app, settings) {
        super(app);
        this.settings = settings;
    }
    onOpen() {
        return __awaiter(this, void 0, void 0, function* () {
            this.titleEl.setText("System Information");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const app = this.app;
            const data = {
                process: {
                    arch: process.arch,
                    platform: process.platform,
                },
                app: {
                    internalPlugins: {
                        config: app.internalPlugins.config,
                    },
                    isMobile: app.isMobile,
                    plugins: {
                        enabledPlugins: Array.from(app.plugins.enabledPlugins),
                        manifests: Object.keys(app.plugins.manifests).reduce((acc, key) => {
                            acc[key] = {
                                version: app.plugins.manifests[key].version,
                            };
                            return acc;
                        }, {}),
                    },
                    vault: {
                        config: app.vault.config,
                    },
                },
                plugin: {
                    settings: { values: this.settings.getValues() },
                },
            };
            const text = JSON.stringify(data, null, 2);
            const pre = this.contentEl.createEl("pre");
            pre.setText(text);
            pre.setCssStyles({
                overflow: "scroll",
                maxHeight: "300px",
            });
            const button = this.contentEl.createEl("button");
            button.setText("Copy and Close");
            button.onClickEvent(() => {
                navigator.clipboard.writeText("```json\n" + text + "\n```");
                this.close();
            });
        });
    }
}
class SystemInfo {
    constructor(plugin, settings) {
        this.plugin = plugin;
        this.settings = settings;
        this.callback = () => {
            const modal = new SystemInfoModal(this.plugin.app, this.settings);
            modal.open();
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.addCommand({
                id: "system-info",
                name: "Show System Info",
                callback: this.callback,
                hotkeys: [
                    {
                        modifiers: ["Mod", "Shift", "Alt"],
                        key: "I",
                    },
                ],
            });
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class TabBehaviourOverride {
    constructor(plugin, imeDetector, obsidianSettings, settings, operationPerformer) {
        this.plugin = plugin;
        this.imeDetector = imeDetector;
        this.obsidianSettings = obsidianSettings;
        this.settings = settings;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return this.settings.overrideTabBehaviour && !this.imeDetector.isOpened();
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new IndentList(root, this.obsidianSettings.getDefaultIndentChars()), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(state.Prec.highest(view.keymap.of([
                {
                    key: "Tab",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ])));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

const VERTICAL_LINES_BODY_CLASS = "outliner-plugin-vertical-lines";
class VerticalLinesPluginValue {
    constructor(settings, obsidianSettings, parser, view) {
        this.settings = settings;
        this.obsidianSettings = obsidianSettings;
        this.parser = parser;
        this.view = view;
        this.lineElements = [];
        this.waitForEditor = () => {
            const editor = getEditorFromState(this.view.state);
            if (!editor) {
                setTimeout(this.waitForEditor, 0);
                return;
            }
            this.editor = editor;
            this.scheduleRecalculate();
        };
        this.onScroll = (e) => {
            const { scrollLeft, scrollTop } = e.target;
            this.scroller.scrollTo(scrollLeft, scrollTop);
        };
        this.scheduleRecalculate = () => {
            clearTimeout(this.scheduled);
            this.scheduled = setTimeout(this.calculate, 0);
        };
        this.calculate = () => {
            this.lines = [];
            if (this.settings.verticalLines &&
                this.obsidianSettings.isDefaultThemeEnabled() &&
                this.view.viewportLineBlocks.length > 0 &&
                this.view.visibleRanges.length > 0) {
                const fromLine = this.editor.offsetToPos(this.view.viewport.from).line;
                const toLine = this.editor.offsetToPos(this.view.viewport.to).line;
                const lists = this.parser.parseRange(this.editor, fromLine, toLine);
                for (const list of lists) {
                    this.lastLine = list.getContentEnd().line;
                    for (const c of list.getChildren()) {
                        this.recursive(c);
                    }
                }
                this.lines.sort((a, b) => a.top === b.top ? a.left - b.left : a.top - b.top);
            }
            this.updateDom();
        };
        this.onClick = (e) => {
            e.preventDefault();
            const line = this.lines[Number(e.target.dataset.index)];
            switch (this.settings.verticalLinesAction) {
                case "zoom-in":
                    this.zoomIn(line);
                    break;
                case "toggle-folding":
                    this.toggleFolding(line);
                    break;
            }
        };
        this.view.scrollDOM.addEventListener("scroll", this.onScroll);
        this.settings.onChange(this.scheduleRecalculate);
        this.prepareDom();
        this.waitForEditor();
    }
    prepareDom() {
        this.contentContainer = document.createElement("div");
        this.contentContainer.classList.add("outliner-plugin-list-lines-content-container");
        this.scroller = document.createElement("div");
        this.scroller.classList.add("outliner-plugin-list-lines-scroller");
        this.scroller.appendChild(this.contentContainer);
        this.view.dom.appendChild(this.scroller);
    }
    update(update) {
        if (update.docChanged ||
            update.viewportChanged ||
            update.geometryChanged ||
            update.transactions.some((tr) => tr.reconfigured)) {
            this.scheduleRecalculate();
        }
    }
    getNextSibling(list) {
        let listTmp = list;
        let p = listTmp.getParent();
        while (p) {
            const nextSibling = p.getNextSiblingOf(listTmp);
            if (nextSibling) {
                return nextSibling;
            }
            listTmp = p;
            p = listTmp.getParent();
        }
        return null;
    }
    recursive(list, parentCtx = {}) {
        const children = list.getChildren();
        if (children.length === 0) {
            return;
        }
        const fromOffset = this.editor.posToOffset({
            line: list.getFirstLineContentStart().line,
            ch: list.getFirstLineIndent().length,
        });
        const nextSibling = this.getNextSibling(list);
        const tillOffset = this.editor.posToOffset({
            line: nextSibling
                ? nextSibling.getFirstLineContentStart().line - 1
                : this.lastLine,
            ch: 0,
        });
        let visibleFrom = this.view.visibleRanges[0].from;
        let visibleTo = this.view.visibleRanges[this.view.visibleRanges.length - 1].to;
        const zoomRange = this.editor.getZoomRange();
        if (zoomRange) {
            visibleFrom = Math.max(visibleFrom, this.editor.posToOffset(zoomRange.from));
            visibleTo = Math.min(visibleTo, this.editor.posToOffset(zoomRange.to));
        }
        if (fromOffset > visibleTo || tillOffset < visibleFrom) {
            return;
        }
        const coords = this.view.coordsAtPos(fromOffset, 1);
        if (!coords) {
            // Skip this subtree while its starting coordinates are unavailable.
            // A later editor update can redraw it if the coordinates become available.
            return;
        }
        if (parentCtx.rootLeft === undefined) {
            parentCtx.rootLeft = coords.left;
        }
        const left = Math.floor(coords.right - parentCtx.rootLeft);
        const top = visibleFrom > 0 && fromOffset < visibleFrom
            ? -20
            : this.view.lineBlockAt(fromOffset).top;
        const bottom = tillOffset > visibleTo
            ? this.view.lineBlockAt(visibleTo - 1).bottom
            : this.view.lineBlockAt(tillOffset).bottom;
        const height = bottom - top;
        if (height > 0 && !list.isFolded()) {
            const nextSibling = list.getParent().getNextSiblingOf(list);
            const hasNextSibling = !!nextSibling &&
                this.editor.posToOffset(nextSibling.getFirstLineContentStart()) <=
                    visibleTo;
            this.lines.push({
                top,
                left,
                height: `calc(${height}px ${hasNextSibling ? "- 1.5em" : "- 2em"})`,
                list,
            });
        }
        for (const child of children) {
            if (!child.isEmpty()) {
                this.recursive(child, parentCtx);
            }
        }
    }
    zoomIn(line) {
        const editor = getEditorFromState(this.view.state);
        editor.zoomIn(line.list.getFirstLineContentStart().line);
    }
    toggleFolding(line) {
        const { list } = line;
        if (list.isEmpty()) {
            return;
        }
        let needToUnfold = true;
        const linesToToggle = [];
        for (const c of list.getChildren()) {
            if (c.isEmpty()) {
                continue;
            }
            if (!c.isFolded()) {
                needToUnfold = false;
            }
            linesToToggle.push(c.getFirstLineContentStart().line);
        }
        const editor = getEditorFromState(this.view.state);
        for (const l of linesToToggle) {
            if (needToUnfold) {
                editor.unfold(l);
            }
            else {
                editor.fold(l);
            }
        }
    }
    updateDom() {
        const cmScroll = this.view.scrollDOM;
        const cmContent = this.view.contentDOM;
        const cmContentContainer = cmContent.parentElement;
        const cmSizer = cmContentContainer.parentElement;
        /**
         * Obsidian can add additional elements into Content Manager.
         * The most obvious case is the 'embedded-backlinks' core plugin that adds a menu inside a Content Manager.
         * We must take heights of all of these elements into account
         * to be able to calculate the correct size of lines' container.
         */
        let cmSizerChildrenSumHeight = 0;
        for (let i = 0; i < cmSizer.children.length; i++) {
            cmSizerChildrenSumHeight += cmSizer.children[i].clientHeight;
        }
        this.scroller.style.top = cmScroll.offsetTop + "px";
        this.contentContainer.style.height = cmSizerChildrenSumHeight + "px";
        this.contentContainer.style.marginLeft =
            cmContentContainer.offsetLeft + "px";
        this.contentContainer.style.marginTop =
            cmContent.firstElementChild.offsetTop - 24 + "px";
        for (let i = 0; i < this.lines.length; i++) {
            if (this.lineElements.length === i) {
                const e = document.createElement("div");
                e.classList.add("outliner-plugin-list-line");
                e.dataset.index = String(i);
                e.addEventListener("mousedown", this.onClick);
                this.contentContainer.appendChild(e);
                this.lineElements.push(e);
            }
            const l = this.lines[i];
            const e = this.lineElements[i];
            e.style.top = l.top + "px";
            e.style.left = l.left + "px";
            e.style.height = l.height;
            e.style.display = "block";
        }
        for (let i = this.lines.length; i < this.lineElements.length; i++) {
            const e = this.lineElements[i];
            e.style.top = "0px";
            e.style.left = "0px";
            e.style.height = "0px";
            e.style.display = "none";
        }
    }
    destroy() {
        this.settings.removeCallback(this.scheduleRecalculate);
        this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
        this.view.dom.removeChild(this.scroller);
        clearTimeout(this.scheduled);
    }
}
class VerticalLines {
    constructor(plugin, settings, obsidianSettings, parser) {
        this.plugin = plugin;
        this.settings = settings;
        this.obsidianSettings = obsidianSettings;
        this.parser = parser;
        this.updateBodyClass = () => {
            const shouldExists = this.obsidianSettings.isDefaultThemeEnabled() &&
                this.settings.verticalLines;
            const exists = document.body.classList.contains(VERTICAL_LINES_BODY_CLASS);
            if (shouldExists && !exists) {
                document.body.classList.add(VERTICAL_LINES_BODY_CLASS);
            }
            if (!shouldExists && exists) {
                document.body.classList.remove(VERTICAL_LINES_BODY_CLASS);
            }
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.updateBodyClass();
            this.updateBodyClassInterval = window.setInterval(() => {
                this.updateBodyClass();
            }, 1000);
            this.plugin.registerEditorExtension(view.ViewPlugin.define((view) => new VerticalLinesPluginValue(this.settings, this.obsidianSettings, this.parser, view)));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            clearInterval(this.updateBodyClassInterval);
            document.body.classList.remove(VERTICAL_LINES_BODY_CLASS);
        });
    }
}

class VimOBehaviourOverride {
    constructor(plugin, settings, obsidianSettings, parser, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.obsidianSettings = obsidianSettings;
        this.parser = parser;
        this.operationPerformer = operationPerformer;
        this.inited = false;
        this.handleSettingsChange = () => {
            if (this.inited || !this.settings.overrideVimOBehaviour) {
                return;
            }
            if (!window.CodeMirrorAdapter || !window.CodeMirrorAdapter.Vim) {
                console.error("Vim adapter not found");
                return;
            }
            const vim = window.CodeMirrorAdapter.Vim;
            const plugin = this.plugin;
            const parser = this.parser;
            const obsidianSettings = this.obsidianSettings;
            const operationPerformer = this.operationPerformer;
            const settings = this.settings;
            vim.defineAction("insertLineAfterBullet", (cm, operatorArgs) => {
                const view = plugin.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
                const obsidianEditor = view === null || view === void 0 ? void 0 : view.editor;
                if (!obsidianEditor) {
                    vim.enterInsertMode(cm);
                    return;
                }
                this.moveCursorToLineEnd(obsidianEditor);
                if (!settings.overrideVimOBehaviour) {
                    this.openPlainLine(obsidianEditor, operatorArgs.after);
                    vim.enterInsertMode(cm);
                    return;
                }
                const editor = new MyEditor(obsidianEditor);
                const root = parser.parse(editor);
                if (!root) {
                    this.openPlainLine(obsidianEditor, operatorArgs.after);
                    vim.enterInsertMode(cm);
                    return;
                }
                const defaultIndentChars = obsidianSettings.getDefaultIndentChars();
                const zoomRange = editor.getZoomRange();
                const getZoomRange = {
                    getZoomRange: () => zoomRange,
                };
                const op = new CreateNewItem(root, defaultIndentChars, getZoomRange, operatorArgs.after, true);
                const res = operationPerformer.eval(root, op, editor);
                if (op.wasSkippedInsideCodeblock()) {
                    // Code blocks inside list items get no new bullet; open a plain
                    // line instead, as Vim would. Other no-op cases (e.g. an empty
                    // item) intentionally leave the text unchanged.
                    this.openPlainLine(obsidianEditor, operatorArgs.after);
                }
                else if (res.shouldUpdate && zoomRange) {
                    editor.tryRefreshZoom(zoomRange.from.line);
                }
                // Ensure the editor is always left in insert mode
                vim.enterInsertMode(cm);
            });
            vim.mapCommand("o", "action", "insertLineAfterBullet", {}, {
                isEdit: true,
                context: "normal",
                interlaceInsertRepeat: true,
                actionArgs: { after: true },
            });
            vim.mapCommand("O", "action", "insertLineAfterBullet", {}, {
                isEdit: true,
                context: "normal",
                interlaceInsertRepeat: true,
                actionArgs: { after: false },
            });
            this.inited = true;
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings.onChange(this.handleSettingsChange);
            this.handleSettingsChange();
        });
    }
    moveCursorToLineEnd(editor) {
        const cursor = editor.getCursor();
        editor.setCursor({
            line: cursor.line,
            ch: editor.getLine(cursor.line).length,
        });
    }
    getLineIndent(line) {
        return line.match(/^[ \t]*/)[0];
    }
    openPlainLine(editor, after) {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const indent = this.getLineIndent(line);
        if (after) {
            const insertAt = { line: cursor.line, ch: line.length };
            editor.replaceRange(`\n${indent}`, insertAt, insertAt);
            editor.setCursor({ line: cursor.line + 1, ch: indent.length });
        }
        else {
            const insertAt = { line: cursor.line, ch: 0 };
            editor.replaceRange(`${indent}\n`, insertAt, insertAt);
            editor.setCursor({ line: cursor.line, ch: indent.length });
        }
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.inited) {
                return;
            }
            new obsidian.Notice(`To fully unload obsidian-outliner plugin, please restart the app`, 5000);
        });
    }
}

class ChangesApplicator {
    apply(editor, prevRoot, newRoot) {
        const changes = this.calculateChanges(editor, prevRoot, newRoot);
        if (changes) {
            const { replacement, changeFrom, changeTo } = changes;
            const { unfold, fold } = this.calculateFoldingOprations(prevRoot, newRoot, changeFrom, changeTo);
            for (const line of unfold) {
                editor.unfold(line);
            }
            editor.replaceRange(replacement, changeFrom, changeTo);
            for (const line of fold) {
                editor.fold(line);
            }
        }
        editor.setSelections(newRoot.getSelections());
    }
    calculateChanges(editor, prevRoot, newRoot) {
        const rootRange = prevRoot.getContentRange();
        const oldString = editor.getRange(rootRange[0], rootRange[1]);
        const newString = newRoot.print();
        const changeFrom = Object.assign({}, rootRange[0]);
        const changeTo = Object.assign({}, rootRange[1]);
        let oldTmp = oldString;
        let newTmp = newString;
        while (true) {
            const nlIndex = oldTmp.lastIndexOf("\n");
            if (nlIndex < 0) {
                break;
            }
            const oldLine = oldTmp.slice(nlIndex);
            const newLine = newTmp.slice(-oldLine.length);
            if (oldLine !== newLine) {
                break;
            }
            oldTmp = oldTmp.slice(0, -oldLine.length);
            newTmp = newTmp.slice(0, -oldLine.length);
            const nlIndex2 = oldTmp.lastIndexOf("\n");
            changeTo.ch =
                nlIndex2 >= 0 ? oldTmp.length - nlIndex2 - 1 : oldTmp.length;
            changeTo.line--;
        }
        while (true) {
            const nlIndex = oldTmp.indexOf("\n");
            if (nlIndex < 0) {
                break;
            }
            const oldLine = oldTmp.slice(0, nlIndex + 1);
            const newLine = newTmp.slice(0, oldLine.length);
            if (oldLine !== newLine) {
                break;
            }
            changeFrom.line++;
            oldTmp = oldTmp.slice(oldLine.length);
            newTmp = newTmp.slice(oldLine.length);
        }
        if (oldTmp === newTmp) {
            return null;
        }
        return {
            replacement: newTmp,
            changeFrom,
            changeTo,
        };
    }
    calculateFoldingOprations(prevRoot, newRoot, changeFrom, changeTo) {
        const changedRange = [changeFrom, changeTo];
        const prevLists = getAllChildren(prevRoot);
        const newLists = getAllChildren(newRoot);
        const unfold = [];
        const fold = [];
        for (const prevList of prevLists.values()) {
            if (!prevList.isFoldRoot()) {
                continue;
            }
            const newList = newLists.get(prevList.getID());
            if (!newList) {
                continue;
            }
            const prevListRange = [
                prevList.getFirstLineContentStart(),
                prevList.getContentEndIncludingChildren(),
            ];
            if (isRangesIntersects(prevListRange, changedRange)) {
                unfold.push(prevList.getFirstLineContentStart().line);
                fold.push(newList.getFirstLineContentStart().line);
            }
        }
        unfold.sort((a, b) => b - a);
        fold.sort((a, b) => b - a);
        return { unfold, fold };
    }
}
function getAllChildrenReduceFn(acc, child) {
    acc.set(child.getID(), child);
    child.getChildren().reduce(getAllChildrenReduceFn, acc);
    return acc;
}
function getAllChildren(root) {
    return root.getChildren().reduce(getAllChildrenReduceFn, new Map());
}

class IMEDetector {
    constructor() {
        this.composition = false;
        this.onCompositionStart = () => {
            this.composition = true;
        };
        this.onCompositionEnd = () => {
            this.composition = false;
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            document.addEventListener("compositionstart", this.onCompositionStart);
            document.addEventListener("compositionend", this.onCompositionEnd);
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            document.removeEventListener("compositionend", this.onCompositionEnd);
            document.removeEventListener("compositionstart", this.onCompositionStart);
        });
    }
    isOpened() {
        return this.composition && obsidian.Platform.isDesktop;
    }
}

class Logger {
    constructor(settings) {
        this.settings = settings;
    }
    log(method, ...args) {
        if (!this.settings.debug) {
            return;
        }
        console.info(method, ...args);
    }
    bind(method) {
        return (...args) => this.log(method, ...args);
    }
}

function getHiddenObsidianConfig(app) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return app.vault.config;
}
class ObsidianSettings {
    constructor(app) {
        this.app = app;
    }
    isLegacyEditorEnabled() {
        const config = Object.assign({ legacyEditor: false }, getHiddenObsidianConfig(this.app));
        return config.legacyEditor;
    }
    isDefaultThemeEnabled() {
        const config = Object.assign({ cssTheme: "" }, getHiddenObsidianConfig(this.app));
        return config.cssTheme === "";
    }
    getTabsSettings() {
        return Object.assign({ useTab: true, tabSize: 4 }, getHiddenObsidianConfig(this.app));
    }
    getFoldSettings() {
        return Object.assign({ foldIndent: true }, getHiddenObsidianConfig(this.app));
    }
    getDefaultIndentChars() {
        const { useTab, tabSize } = this.getTabsSettings();
        return useTab ? "\t" : new Array(tabSize).fill(" ").join("");
    }
}

class OperationPerformer {
    constructor(parser, changesApplicator) {
        this.parser = parser;
        this.changesApplicator = changesApplicator;
    }
    eval(root, op, editor) {
        const prevRoot = root.clone();
        op.perform();
        if (op.shouldUpdate()) {
            this.changesApplicator.apply(editor, prevRoot, root);
        }
        return {
            shouldUpdate: op.shouldUpdate(),
            shouldStopPropagation: op.shouldStopPropagation(),
        };
    }
    perform(cb, editor, cursor = editor.getCursor()) {
        const root = this.parser.parse(editor, cursor);
        if (!root) {
            return { shouldUpdate: false, shouldStopPropagation: false };
        }
        const op = cb(root);
        return this.eval(root, op, editor);
    }
}

const bulletSignRe = `(?:[-*+]|\\d+\\.)`;
const optionalCheckboxRe = `(?:${checkboxRe})?`;
const listItemWithoutSpacesRe = new RegExp(`^${bulletSignRe}( |\t)`);
const listItemRe = new RegExp(`^[ \t]*${bulletSignRe}( |\t)`);
const stringWithSpacesRe = new RegExp(`^[ \t]+`);
const parseListItemRe = new RegExp(`^([ \t]*)(${bulletSignRe})( |\t)(${optionalCheckboxRe})(.*)$`);
class Parser {
    constructor(logger, settings) {
        this.logger = logger;
        this.settings = settings;
    }
    parseRange(editor, fromLine = 0, toLine = editor.lastLine()) {
        const lists = [];
        for (let i = fromLine; i <= toLine; i++) {
            const line = editor.getLine(i);
            if (i === fromLine || this.isListItem(line)) {
                const list = this.parseWithLimits(editor, i, fromLine, toLine);
                if (list) {
                    lists.push(list);
                    i = list.getContentEnd().line;
                }
            }
        }
        return lists;
    }
    parse(editor, cursor = editor.getCursor()) {
        return this.parseWithLimits(editor, cursor.line, 0, editor.lastLine());
    }
    parseWithLimits(editor, parsingStartLine, limitFrom, limitTo) {
        const d = this.logger.bind("parseList");
        const error = (msg) => {
            d(msg);
            return null;
        };
        const line = editor.getLine(parsingStartLine);
        let listLookingPos = null;
        if (this.isListItem(line)) {
            listLookingPos = parsingStartLine;
        }
        else if (this.isLineWithIndent(line)) {
            let listLookingPosSearch = parsingStartLine - 1;
            while (listLookingPosSearch >= 0) {
                const line = editor.getLine(listLookingPosSearch);
                if (this.isListItem(line)) {
                    listLookingPos = listLookingPosSearch;
                    break;
                }
                else if (this.isLineWithIndent(line)) {
                    listLookingPosSearch--;
                }
                else {
                    break;
                }
            }
        }
        if (listLookingPos === null) {
            return null;
        }
        let listStartLine = null;
        let listStartLineLookup = listLookingPos;
        while (listStartLineLookup >= 0) {
            const line = editor.getLine(listStartLineLookup);
            if (!this.isListItem(line) && !this.isLineWithIndent(line)) {
                break;
            }
            if (this.isListItemWithoutSpaces(line)) {
                listStartLine = listStartLineLookup;
                if (listStartLineLookup <= limitFrom) {
                    break;
                }
            }
            listStartLineLookup--;
        }
        if (listStartLine === null) {
            return null;
        }
        let listEndLine = listLookingPos;
        let listEndLineLookup = listLookingPos;
        while (listEndLineLookup <= editor.lastLine()) {
            const line = editor.getLine(listEndLineLookup);
            if (!this.isListItem(line) && !this.isLineWithIndent(line)) {
                break;
            }
            if (!this.isEmptyLine(line)) {
                listEndLine = listEndLineLookup;
            }
            if (listEndLineLookup >= limitTo) {
                listEndLine = limitTo;
                break;
            }
            listEndLineLookup++;
        }
        // Whitespace that cannot be represented as a note separates lists. Resolve
        // both boundaries before building the model, regardless of cursor position.
        for (const boundary of this.findWhitespaceBoundaries(editor, listStartLine, listEndLine)) {
            if (boundary === parsingStartLine) {
                return null;
            }
            if (boundary < parsingStartLine) {
                listStartLine = boundary + 1;
            }
            else {
                listEndLine = boundary - 1;
                break;
            }
        }
        // A segment must start with a top-level item, not orphaned notes/children.
        while (listStartLine <= parsingStartLine &&
            !this.isListItemWithoutSpaces(editor.getLine(listStartLine))) {
            listStartLine++;
        }
        if (listStartLine > parsingStartLine || listEndLine < parsingStartLine) {
            return null;
        }
        const root = new Root({ line: listStartLine, ch: 0 }, { line: listEndLine, ch: editor.getLine(listEndLine).length }, editor.listSelections().map((r) => ({
            anchor: { line: r.anchor.line, ch: r.anchor.ch },
            head: { line: r.head.line, ch: r.head.ch },
        })));
        let currentParent = root.getRootList();
        let currentList = null;
        let currentIndent = "";
        const foldedLines = editor.getAllFoldedLines();
        for (let l = listStartLine; l <= listEndLine; l++) {
            const line = editor.getLine(l);
            const matches = parseListItemRe.exec(line);
            if (matches) {
                const [, indent, bullet, spaceAfterBullet] = matches;
                let [, , , , optionalCheckbox, content] = matches;
                content = optionalCheckbox + content;
                if (this.settings.keepCursorWithinContent !== "bullet-and-checkbox") {
                    optionalCheckbox = "";
                }
                const compareLength = Math.min(currentIndent.length, indent.length);
                const indentSlice = indent.slice(0, compareLength);
                const currentIndentSlice = currentIndent.slice(0, compareLength);
                if (indentSlice !== currentIndentSlice) {
                    const expected = currentIndentSlice
                        .replace(/ /g, "S")
                        .replace(/\t/g, "T");
                    const got = indentSlice.replace(/ /g, "S").replace(/\t/g, "T");
                    return error(`Unable to parse list: expected indent "${expected}", got "${got}"`);
                }
                if (indent.length > currentIndent.length) {
                    currentParent = currentList;
                    currentIndent = indent;
                }
                else if (indent.length < currentIndent.length) {
                    while (currentParent.getFirstLineIndent().length >= indent.length &&
                        currentParent.getParent()) {
                        currentParent = currentParent.getParent();
                    }
                    currentIndent = indent;
                }
                const foldRoot = foldedLines.includes(l);
                currentList = new List(root, indent, bullet, optionalCheckbox, spaceAfterBullet, content, foldRoot);
                currentParent.addAfterAll(currentList);
            }
            else if (this.isLineWithIndent(line)) {
                if (!currentList) {
                    return error(`Unable to parse list: expected list item, got empty line`);
                }
                const indentToCheck = currentList.getNotesIndent() || currentIndent;
                if (line.indexOf(indentToCheck) !== 0) {
                    const expected = indentToCheck.replace(/ /g, "S").replace(/\t/g, "T");
                    const got = line
                        .match(/^[ \t]*/)[0]
                        .replace(/ /g, "S")
                        .replace(/\t/g, "T");
                    return error(`Unable to parse list: expected indent "${expected}", got "${got}"`);
                }
                if (!currentList.getNotesIndent()) {
                    const matches = line.match(/^[ \t]+/);
                    if (!matches || matches[0].length <= currentIndent.length) {
                        // Skipping a line would desynchronize the model and editor ranges.
                        return error(`Unable to parse list: expected some indent, got no indent`);
                    }
                    currentList.setNotesIndent(matches[0]);
                }
                currentList.addLine(line.slice(currentList.getNotesIndent().length));
            }
            else {
                return error(`Unable to parse list: expected list item or note, got "${line}"`);
            }
        }
        return root;
    }
    findWhitespaceBoundaries(editor, fromLine, toLine) {
        const boundaries = [];
        let itemIndent = "";
        let notesIndent = null;
        for (let l = fromLine; l <= toLine; l++) {
            const line = editor.getLine(l);
            const item = parseListItemRe.exec(line);
            if (item) {
                itemIndent = item[1];
                notesIndent = null;
            }
            else if (this.isLineWithIndent(line)) {
                const indent = line.match(/^[ \t]+/)[0];
                if (/^\s+$/.test(line) &&
                    (!line.startsWith(notesIndent !== null && notesIndent !== void 0 ? notesIndent : itemIndent) ||
                        (notesIndent === null && indent.length <= itemIndent.length))) {
                    boundaries.push(l);
                    itemIndent = "";
                    notesIndent = null;
                }
                else if (notesIndent === null) {
                    notesIndent = indent;
                }
            }
        }
        return boundaries;
    }
    isEmptyLine(line) {
        return line.length === 0;
    }
    isLineWithIndent(line) {
        return stringWithSpacesRe.test(line);
    }
    isListItem(line) {
        return listItemRe.test(line);
    }
    isListItemWithoutSpaces(line) {
        return listItemWithoutSpacesRe.test(line);
    }
}

const DEFAULT_SETTINGS = {
    styleLists: true,
    debug: false,
    stickCursor: "bullet-and-checkbox",
    betterEnter: true,
    betterEnterOutdent: true,
    betterVimO: true,
    betterTab: true,
    selectAll: true,
    expandSelection: false,
    listLines: false,
    listLineAction: "toggle-folding",
    dnd: true,
    previousRelease: null,
};
class Settings {
    constructor(storage) {
        this.storage = storage;
        this.callbacks = new Set();
    }
    get keepCursorWithinContent() {
        // Adaptor for users migrating from older version of the plugin.
        if (this.values.stickCursor === true) {
            return "bullet-and-checkbox";
        }
        else if (this.values.stickCursor === false) {
            return "never";
        }
        return this.values.stickCursor;
    }
    set keepCursorWithinContent(value) {
        this.set("stickCursor", value);
    }
    get overrideTabBehaviour() {
        return this.values.betterTab;
    }
    set overrideTabBehaviour(value) {
        this.set("betterTab", value);
    }
    get overrideEnterBehaviour() {
        return this.values.betterEnter;
    }
    set overrideEnterBehaviour(value) {
        this.set("betterEnter", value);
    }
    get enterOutdentsEmptyListItem() {
        return this.values.betterEnterOutdent;
    }
    set enterOutdentsEmptyListItem(value) {
        this.set("betterEnterOutdent", value);
    }
    get overrideVimOBehaviour() {
        return this.values.betterVimO;
    }
    set overrideVimOBehaviour(value) {
        this.set("betterVimO", value);
    }
    get overrideSelectAllBehaviour() {
        return this.values.selectAll;
    }
    set overrideSelectAllBehaviour(value) {
        this.set("selectAll", value);
    }
    get expandSelection() {
        return this.values.expandSelection;
    }
    set expandSelection(value) {
        this.set("expandSelection", value);
    }
    get betterListsStyles() {
        return this.values.styleLists;
    }
    set betterListsStyles(value) {
        this.set("styleLists", value);
    }
    get verticalLines() {
        return this.values.listLines;
    }
    set verticalLines(value) {
        this.set("listLines", value);
    }
    get verticalLinesAction() {
        return this.values.listLineAction;
    }
    set verticalLinesAction(value) {
        this.set("listLineAction", value);
    }
    get dragAndDrop() {
        return this.values.dnd;
    }
    set dragAndDrop(value) {
        this.set("dnd", value);
    }
    get debug() {
        return this.values.debug;
    }
    set debug(value) {
        this.set("debug", value);
    }
    get previousRelease() {
        return this.values.previousRelease;
    }
    set previousRelease(value) {
        this.set("previousRelease", value);
    }
    onChange(cb) {
        this.callbacks.add(cb);
    }
    removeCallback(cb) {
        this.callbacks.delete(cb);
    }
    reset() {
        for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
            this.set(k, v);
        }
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.values = Object.assign({}, DEFAULT_SETTINGS, yield this.storage.loadData());
        });
    }
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.storage.saveData(this.values);
        });
    }
    getValues() {
        return Object.assign({}, this.values);
    }
    set(key, value) {
        this.values[key] = value;
        for (const cb of this.callbacks) {
            cb();
        }
    }
}

class ObsidianOutlinerPlugin extends obsidian.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Loading obsidian-outliner`);
            yield this.prepareSettings();
            this.obsidianSettings = new ObsidianSettings(this.app);
            this.logger = new Logger(this.settings);
            this.parser = new Parser(this.logger, this.settings);
            this.changesApplicator = new ChangesApplicator();
            this.operationPerformer = new OperationPerformer(this.parser, this.changesApplicator);
            this.imeDetector = new IMEDetector();
            yield this.imeDetector.load();
            this.features = [
                // service features
                // new ReleaseNotesAnnouncement(this, this.settings),
                new SettingsTab(this, this.settings),
                new SystemInfo(this, this.settings),
                // general features
                new ListsMovementCommands(this, this.obsidianSettings, this.operationPerformer),
                new ListsFoldingCommands(this, this.obsidianSettings),
                // features based on settings.keepCursorWithinContent
                new EditorSelectionsBehaviourOverride(this, this.settings, this.parser, this.operationPerformer),
                new ArrowLeftAndCtrlArrowLeftBehaviourOverride(this, this.settings, this.imeDetector, this.operationPerformer),
                new BackspaceBehaviourOverride(this, this.settings, this.imeDetector, this.operationPerformer),
                new MetaBackspaceBehaviourOverride(this, this.settings, this.imeDetector, this.operationPerformer),
                new DeleteBehaviourOverride(this, this.settings, this.imeDetector, this.operationPerformer),
                // features based on settings.overrideTabBehaviour
                new TabBehaviourOverride(this, this.imeDetector, this.obsidianSettings, this.settings, this.operationPerformer),
                new ShiftTabBehaviourOverride(this, this.imeDetector, this.settings, this.operationPerformer),
                // features based on settings.overrideEnterBehaviour
                new EnterBehaviourOverride(this, this.settings, this.imeDetector, this.obsidianSettings, this.parser, this.operationPerformer),
                // features based on settings.overrideVimOBehaviour
                new VimOBehaviourOverride(this, this.settings, this.obsidianSettings, this.parser, this.operationPerformer),
                // features based on settings.overrideSelectAllBehaviour
                new CtrlAAndCmdABehaviourOverride(this, this.settings, this.imeDetector, this.operationPerformer),
                // features based on settings.betterListsStyles
                new BetterListsStyles(this.settings, this.obsidianSettings),
                // features based on settings.verticalLines
                new VerticalLines(this, this.settings, this.obsidianSettings, this.parser),
                // features based on settings.dragAndDrop
                new DragAndDrop(this, this.settings, this.obsidianSettings, this.parser, this.operationPerformer),
            ];
            for (const feature of this.features) {
                yield feature.load();
            }
        });
    }
    onunload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Unloading obsidian-outliner`);
            yield this.imeDetector.unload();
            for (const feature of this.features) {
                yield feature.unload();
            }
        });
    }
    prepareSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = new Settings(this);
            yield this.settings.load();
        });
    }
}

module.exports = ObsidianOutlinerPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsiLi4vbm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsIi4uLy4uL3NyYy9vcGVyYXRpb25zL01vdmVDdXJzb3JUb1ByZXZpb3VzVW5mb2xkZWRMaW5lLnRzIiwiLi4vLi4vc3JjL2VkaXRvci9pbmRleC50cyIsIi4uLy4uL3NyYy91dGlscy9jcmVhdGVLZXltYXBSdW5DYWxsYmFjay50cyIsIi4uLy4uL3NyYy9mZWF0dXJlcy9BcnJvd0xlZnRBbmRDdHJsQXJyb3dMZWZ0QmVoYXZpb3VyT3ZlcnJpZGUudHMiLCIuLi8uLi9zcmMvcm9vdC9pbmRleC50cyIsIi4uLy4uL3NyYy9vcGVyYXRpb25zL0RlbGV0ZVRpbGxQcmV2aW91c0xpbmVDb250ZW50RW5kLnRzIiwiLi4vLi4vc3JjL2ZlYXR1cmVzL0JhY2tzcGFjZUJlaGF2aW91ck92ZXJyaWRlLnRzIiwiLi4vLi4vc3JjL2ZlYXR1cmVzL0JldHRlckxpc3RzU3R5bGVzLnRzIiwiLi4vLi4vc3JjL29wZXJhdGlvbnMvU2VsZWN0QWxsQ29udGVudC50cyIsIi4uLy4uL3NyYy9mZWF0dXJlcy9DdHJsQUFuZENtZEFCZWhhdmlvdXJPdmVycmlkZS50cyIsIi4uLy4uL3NyYy9vcGVyYXRpb25zL0RlbGV0ZVRpbGxOZXh0TGluZUNvbnRlbnRTdGFydC50cyIsIi4uLy4uL3NyYy9mZWF0dXJlcy9EZWxldGVCZWhhdmlvdXJPdmVycmlkZS50cyIsIi4uLy4uL3NyYy9vcGVyYXRpb25zL01vdmVMaXN0VG9EaWZmZXJlbnRQb3NpdGlvbi50cyIsIi4uLy4uL3NyYy9mZWF0dXJlcy9EcmFnQW5kRHJvcC50cyIsIi4uLy4uL3NyYy9vcGVyYXRpb25zL0V4cGFuZFNlbGVjdGlvblRvRnVsbEl0ZW1zLnRzIiwiLi4vLi4vc3JjL29wZXJhdGlvbnMvS2VlcEN1cnNvck91dHNpZGVGb2xkZWRMaW5lcy50cyIsIi4uLy4uL3NyYy9vcGVyYXRpb25zL0tlZXBDdXJzb3JXaXRoaW5MaXN0Q29udGVudC50cyIsIi4uLy4uL3NyYy9mZWF0dXJlcy9FZGl0b3JTZWxlY3Rpb25zQmVoYXZpb3VyT3ZlcnJpZGUudHMiLCIuLi8uLi9zcmMvdXRpbHMvY2hlY2tib3hSZS50cyIsIi4uLy4uL3NyYy91dGlscy9pc0VtcHR5TGluZU9yRW1wdHlDaGVja2JveC50cyIsIi4uLy4uL3NyYy9vcGVyYXRpb25zL0NyZWF0ZU5ld0l0ZW0udHMiLCIuLi8uLi9zcmMvb3BlcmF0aW9ucy9PdXRkZW50TGlzdC50cyIsIi4uLy4uL3NyYy9vcGVyYXRpb25zL091dGRlbnRMaXN0SWZJdHNFbXB0eS50cyIsIi4uLy4uL3NyYy9mZWF0dXJlcy9FbnRlckJlaGF2aW91ck92ZXJyaWRlLnRzIiwiLi4vLi4vc3JjL3V0aWxzL2NyZWF0ZUVkaXRvckNhbGxiYWNrLnRzIiwiLi4vLi4vc3JjL2ZlYXR1cmVzL0xpc3RzRm9sZGluZ0NvbW1hbmRzLnRzIiwiLi4vLi4vc3JjL29wZXJhdGlvbnMvSW5kZW50TGlzdC50cyIsIi4uLy4uL3NyYy9vcGVyYXRpb25zL01vdmVMaXN0RG93bi50cyIsIi4uLy4uL3NyYy9vcGVyYXRpb25zL01vdmVMaXN0VXAudHMiLCIuLi8uLi9zcmMvZmVhdHVyZXMvTGlzdHNNb3ZlbWVudENvbW1hbmRzLnRzIiwiLi4vLi4vc3JjL29wZXJhdGlvbnMvRGVsZXRlVGlsbEN1cnJlbnRMaW5lQ29udGVudFN0YXJ0LnRzIiwiLi4vLi4vc3JjL2ZlYXR1cmVzL01ldGFCYWNrc3BhY2VCZWhhdmlvdXJPdmVycmlkZS50cyIsIi4uLy4uL3NyYy9mZWF0dXJlcy9TZXR0aW5nc1RhYi50cyIsIi4uLy4uL3NyYy9mZWF0dXJlcy9TaGlmdFRhYkJlaGF2aW91ck92ZXJyaWRlLnRzIiwiLi4vLi4vc3JjL2ZlYXR1cmVzL1N5c3RlbUluZm8udHMiLCIuLi8uLi9zcmMvZmVhdHVyZXMvVGFiQmVoYXZpb3VyT3ZlcnJpZGUudHMiLCIuLi8uLi9zcmMvZmVhdHVyZXMvVmVydGljYWxMaW5lcy50cyIsIi4uLy4uL3NyYy9mZWF0dXJlcy9WaW1PQmVoYXZpb3VyT3ZlcnJpZGUudHMiLCIuLi8uLi9zcmMvc2VydmljZXMvQ2hhbmdlc0FwcGxpY2F0b3IudHMiLCIuLi8uLi9zcmMvc2VydmljZXMvSU1FRGV0ZWN0b3IudHMiLCIuLi8uLi9zcmMvc2VydmljZXMvTG9nZ2VyLnRzIiwiLi4vLi4vc3JjL3NlcnZpY2VzL09ic2lkaWFuU2V0dGluZ3MudHMiLCIuLi8uLi9zcmMvc2VydmljZXMvT3BlcmF0aW9uUGVyZm9ybWVyLnRzIiwiLi4vLi4vc3JjL3NlcnZpY2VzL1BhcnNlci50cyIsIi4uLy4uL3NyYy9zZXJ2aWNlcy9TZXR0aW5ncy50cyIsIi4uLy4uL3NyYy9PYnNpZGlhbk91dGxpbmVyUGx1Z2luLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uXHJcblxyXG5QZXJtaXNzaW9uIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBhbmQvb3IgZGlzdHJpYnV0ZSB0aGlzIHNvZnR3YXJlIGZvciBhbnlcclxucHVycG9zZSB3aXRoIG9yIHdpdGhvdXQgZmVlIGlzIGhlcmVieSBncmFudGVkLlxyXG5cclxuVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiBBTkQgVEhFIEFVVEhPUiBESVNDTEFJTVMgQUxMIFdBUlJBTlRJRVMgV0lUSFxyXG5SRUdBUkQgVE8gVEhJUyBTT0ZUV0FSRSBJTkNMVURJTkcgQUxMIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFlcclxuQU5EIEZJVE5FU1MuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1IgQkUgTElBQkxFIEZPUiBBTlkgU1BFQ0lBTCwgRElSRUNULFxyXG5JTkRJUkVDVCwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIE9SIEFOWSBEQU1BR0VTIFdIQVRTT0VWRVIgUkVTVUxUSU5HIEZST01cclxuTE9TUyBPRiBVU0UsIERBVEEgT1IgUFJPRklUUywgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIE5FR0xJR0VOQ0UgT1JcclxuT1RIRVIgVE9SVElPVVMgQUNUSU9OLCBBUklTSU5HIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFVTRSBPUlxyXG5QRVJGT1JNQU5DRSBPRiBUSElTIFNPRlRXQVJFLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG4vKiBnbG9iYWwgUmVmbGVjdCwgUHJvbWlzZSwgU3VwcHJlc3NlZEVycm9yLCBTeW1ib2wsIEl0ZXJhdG9yICovXHJcblxyXG52YXIgZXh0ZW5kU3RhdGljcyA9IGZ1bmN0aW9uKGQsIGIpIHtcclxuICAgIGV4dGVuZFN0YXRpY3MgPSBPYmplY3Quc2V0UHJvdG90eXBlT2YgfHxcclxuICAgICAgICAoeyBfX3Byb3RvX186IFtdIH0gaW5zdGFuY2VvZiBBcnJheSAmJiBmdW5jdGlvbiAoZCwgYikgeyBkLl9fcHJvdG9fXyA9IGI7IH0pIHx8XHJcbiAgICAgICAgZnVuY3Rpb24gKGQsIGIpIHsgZm9yICh2YXIgcCBpbiBiKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGIsIHApKSBkW3BdID0gYltwXTsgfTtcclxuICAgIHJldHVybiBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXh0ZW5kcyhkLCBiKSB7XHJcbiAgICBpZiAodHlwZW9mIGIgIT09IFwiZnVuY3Rpb25cIiAmJiBiICE9PSBudWxsKVxyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDbGFzcyBleHRlbmRzIHZhbHVlIFwiICsgU3RyaW5nKGIpICsgXCIgaXMgbm90IGEgY29uc3RydWN0b3Igb3IgbnVsbFwiKTtcclxuICAgIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbiAgICBmdW5jdGlvbiBfXygpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGQ7IH1cclxuICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2Fzc2lnbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgX19hc3NpZ24gPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uIF9fYXNzaWduKHQpIHtcclxuICAgICAgICBmb3IgKHZhciBzLCBpID0gMSwgbiA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcclxuICAgICAgICAgICAgcyA9IGFyZ3VtZW50c1tpXTtcclxuICAgICAgICAgICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApKSB0W3BdID0gc1twXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gX19hc3NpZ24uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVzdChzLCBlKSB7XHJcbiAgICB2YXIgdCA9IHt9O1xyXG4gICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApICYmIGUuaW5kZXhPZihwKSA8IDApXHJcbiAgICAgICAgdFtwXSA9IHNbcF07XHJcbiAgICBpZiAocyAhPSBudWxsICYmIHR5cGVvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzID09PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIHAgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHMpOyBpIDwgcC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAoZS5pbmRleE9mKHBbaV0pIDwgMCAmJiBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwocywgcFtpXSkpXHJcbiAgICAgICAgICAgICAgICB0W3BbaV1dID0gc1twW2ldXTtcclxuICAgICAgICB9XHJcbiAgICByZXR1cm4gdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpIHtcclxuICAgIHZhciBjID0gYXJndW1lbnRzLmxlbmd0aCwgciA9IGMgPCAzID8gdGFyZ2V0IDogZGVzYyA9PT0gbnVsbCA/IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwga2V5KSA6IGRlc2MsIGQ7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QuZGVjb3JhdGUgPT09IFwiZnVuY3Rpb25cIikgciA9IFJlZmxlY3QuZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpO1xyXG4gICAgZWxzZSBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgaWYgKGQgPSBkZWNvcmF0b3JzW2ldKSByID0gKGMgPCAzID8gZChyKSA6IGMgPiAzID8gZCh0YXJnZXQsIGtleSwgcikgOiBkKHRhcmdldCwga2V5KSkgfHwgcjtcclxuICAgIHJldHVybiBjID4gMyAmJiByICYmIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGtleSwgciksIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3BhcmFtKHBhcmFtSW5kZXgsIGRlY29yYXRvcikge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uICh0YXJnZXQsIGtleSkgeyBkZWNvcmF0b3IodGFyZ2V0LCBrZXksIHBhcmFtSW5kZXgpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2VzRGVjb3JhdGUoY3RvciwgZGVzY3JpcHRvckluLCBkZWNvcmF0b3JzLCBjb250ZXh0SW4sIGluaXRpYWxpemVycywgZXh0cmFJbml0aWFsaXplcnMpIHtcclxuICAgIGZ1bmN0aW9uIGFjY2VwdChmKSB7IGlmIChmICE9PSB2b2lkIDAgJiYgdHlwZW9mIGYgIT09IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkZ1bmN0aW9uIGV4cGVjdGVkXCIpOyByZXR1cm4gZjsgfVxyXG4gICAgdmFyIGtpbmQgPSBjb250ZXh0SW4ua2luZCwga2V5ID0ga2luZCA9PT0gXCJnZXR0ZXJcIiA/IFwiZ2V0XCIgOiBraW5kID09PSBcInNldHRlclwiID8gXCJzZXRcIiA6IFwidmFsdWVcIjtcclxuICAgIHZhciB0YXJnZXQgPSAhZGVzY3JpcHRvckluICYmIGN0b3IgPyBjb250ZXh0SW5bXCJzdGF0aWNcIl0gPyBjdG9yIDogY3Rvci5wcm90b3R5cGUgOiBudWxsO1xyXG4gICAgdmFyIGRlc2NyaXB0b3IgPSBkZXNjcmlwdG9ySW4gfHwgKHRhcmdldCA/IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBjb250ZXh0SW4ubmFtZSkgOiB7fSk7XHJcbiAgICB2YXIgXywgZG9uZSA9IGZhbHNlO1xyXG4gICAgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcclxuICAgICAgICB2YXIgY29udGV4dCA9IHt9O1xyXG4gICAgICAgIGZvciAodmFyIHAgaW4gY29udGV4dEluKSBjb250ZXh0W3BdID0gcCA9PT0gXCJhY2Nlc3NcIiA/IHt9IDogY29udGV4dEluW3BdO1xyXG4gICAgICAgIGZvciAodmFyIHAgaW4gY29udGV4dEluLmFjY2VzcykgY29udGV4dC5hY2Nlc3NbcF0gPSBjb250ZXh0SW4uYWNjZXNzW3BdO1xyXG4gICAgICAgIGNvbnRleHQuYWRkSW5pdGlhbGl6ZXIgPSBmdW5jdGlvbiAoZikgeyBpZiAoZG9uZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBhZGQgaW5pdGlhbGl6ZXJzIGFmdGVyIGRlY29yYXRpb24gaGFzIGNvbXBsZXRlZFwiKTsgZXh0cmFJbml0aWFsaXplcnMucHVzaChhY2NlcHQoZiB8fCBudWxsKSk7IH07XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9ICgwLCBkZWNvcmF0b3JzW2ldKShraW5kID09PSBcImFjY2Vzc29yXCIgPyB7IGdldDogZGVzY3JpcHRvci5nZXQsIHNldDogZGVzY3JpcHRvci5zZXQgfSA6IGRlc2NyaXB0b3Jba2V5XSwgY29udGV4dCk7XHJcbiAgICAgICAgaWYgKGtpbmQgPT09IFwiYWNjZXNzb3JcIikge1xyXG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSB2b2lkIDApIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsIHx8IHR5cGVvZiByZXN1bHQgIT09IFwib2JqZWN0XCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QgZXhwZWN0ZWRcIik7XHJcbiAgICAgICAgICAgIGlmIChfID0gYWNjZXB0KHJlc3VsdC5nZXQpKSBkZXNjcmlwdG9yLmdldCA9IF87XHJcbiAgICAgICAgICAgIGlmIChfID0gYWNjZXB0KHJlc3VsdC5zZXQpKSBkZXNjcmlwdG9yLnNldCA9IF87XHJcbiAgICAgICAgICAgIGlmIChfID0gYWNjZXB0KHJlc3VsdC5pbml0KSkgaW5pdGlhbGl6ZXJzLnVuc2hpZnQoXyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKF8gPSBhY2NlcHQocmVzdWx0KSkge1xyXG4gICAgICAgICAgICBpZiAoa2luZCA9PT0gXCJmaWVsZFwiKSBpbml0aWFsaXplcnMudW5zaGlmdChfKTtcclxuICAgICAgICAgICAgZWxzZSBkZXNjcmlwdG9yW2tleV0gPSBfO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGlmICh0YXJnZXQpIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGNvbnRleHRJbi5uYW1lLCBkZXNjcmlwdG9yKTtcclxuICAgIGRvbmUgPSB0cnVlO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcnVuSW5pdGlhbGl6ZXJzKHRoaXNBcmcsIGluaXRpYWxpemVycywgdmFsdWUpIHtcclxuICAgIHZhciB1c2VWYWx1ZSA9IGFyZ3VtZW50cy5sZW5ndGggPiAyO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbml0aWFsaXplcnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICB2YWx1ZSA9IHVzZVZhbHVlID8gaW5pdGlhbGl6ZXJzW2ldLmNhbGwodGhpc0FyZywgdmFsdWUpIDogaW5pdGlhbGl6ZXJzW2ldLmNhbGwodGhpc0FyZyk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdXNlVmFsdWUgPyB2YWx1ZSA6IHZvaWQgMDtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Byb3BLZXkoeCkge1xyXG4gICAgcmV0dXJuIHR5cGVvZiB4ID09PSBcInN5bWJvbFwiID8geCA6IFwiXCIuY29uY2F0KHgpO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc2V0RnVuY3Rpb25OYW1lKGYsIG5hbWUsIHByZWZpeCkge1xyXG4gICAgaWYgKHR5cGVvZiBuYW1lID09PSBcInN5bWJvbFwiKSBuYW1lID0gbmFtZS5kZXNjcmlwdGlvbiA/IFwiW1wiLmNvbmNhdChuYW1lLmRlc2NyaXB0aW9uLCBcIl1cIikgOiBcIlwiO1xyXG4gICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShmLCBcIm5hbWVcIiwgeyBjb25maWd1cmFibGU6IHRydWUsIHZhbHVlOiBwcmVmaXggPyBcIlwiLmNvbmNhdChwcmVmaXgsIFwiIFwiLCBuYW1lKSA6IG5hbWUgfSk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSkge1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0Lm1ldGFkYXRhID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiBSZWZsZWN0Lm1ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXRlcih0aGlzQXJnLCBfYXJndW1lbnRzLCBQLCBnZW5lcmF0b3IpIHtcclxuICAgIGZ1bmN0aW9uIGFkb3B0KHZhbHVlKSB7IHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFAgPyB2YWx1ZSA6IG5ldyBQKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJlc29sdmUodmFsdWUpOyB9KTsgfVxyXG4gICAgcmV0dXJuIG5ldyAoUCB8fCAoUCA9IFByb21pc2UpKShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgZnVuY3Rpb24gZnVsZmlsbGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHJlamVjdGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yW1widGhyb3dcIl0odmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHN0ZXAocmVzdWx0KSB7IHJlc3VsdC5kb25lID8gcmVzb2x2ZShyZXN1bHQudmFsdWUpIDogYWRvcHQocmVzdWx0LnZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpOyB9XHJcbiAgICAgICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pKS5uZXh0KCkpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2dlbmVyYXRvcih0aGlzQXJnLCBib2R5KSB7XHJcbiAgICB2YXIgXyA9IHsgbGFiZWw6IDAsIHNlbnQ6IGZ1bmN0aW9uKCkgeyBpZiAodFswXSAmIDEpIHRocm93IHRbMV07IHJldHVybiB0WzFdOyB9LCB0cnlzOiBbXSwgb3BzOiBbXSB9LCBmLCB5LCB0LCBnID0gT2JqZWN0LmNyZWF0ZSgodHlwZW9mIEl0ZXJhdG9yID09PSBcImZ1bmN0aW9uXCIgPyBJdGVyYXRvciA6IE9iamVjdCkucHJvdG90eXBlKTtcclxuICAgIHJldHVybiBnLm5leHQgPSB2ZXJiKDApLCBnW1widGhyb3dcIl0gPSB2ZXJiKDEpLCBnW1wicmV0dXJuXCJdID0gdmVyYigyKSwgdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIChnW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXM7IH0pLCBnO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IHJldHVybiBmdW5jdGlvbiAodikgeyByZXR1cm4gc3RlcChbbiwgdl0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKG9wKSB7XHJcbiAgICAgICAgaWYgKGYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJHZW5lcmF0b3IgaXMgYWxyZWFkeSBleGVjdXRpbmcuXCIpO1xyXG4gICAgICAgIHdoaWxlIChnICYmIChnID0gMCwgb3BbMF0gJiYgKF8gPSAwKSksIF8pIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChmID0gMSwgeSAmJiAodCA9IG9wWzBdICYgMiA/IHlbXCJyZXR1cm5cIl0gOiBvcFswXSA/IHlbXCJ0aHJvd1wiXSB8fCAoKHQgPSB5W1wicmV0dXJuXCJdKSAmJiB0LmNhbGwoeSksIDApIDogeS5uZXh0KSAmJiAhKHQgPSB0LmNhbGwoeSwgb3BbMV0pKS5kb25lKSByZXR1cm4gdDtcclxuICAgICAgICAgICAgaWYgKHkgPSAwLCB0KSBvcCA9IFtvcFswXSAmIDIsIHQudmFsdWVdO1xyXG4gICAgICAgICAgICBzd2l0Y2ggKG9wWzBdKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDA6IGNhc2UgMTogdCA9IG9wOyBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgNDogXy5sYWJlbCsrOyByZXR1cm4geyB2YWx1ZTogb3BbMV0sIGRvbmU6IGZhbHNlIH07XHJcbiAgICAgICAgICAgICAgICBjYXNlIDU6IF8ubGFiZWwrKzsgeSA9IG9wWzFdOyBvcCA9IFswXTsgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDc6IG9wID0gXy5vcHMucG9wKCk7IF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghKHQgPSBfLnRyeXMsIHQgPSB0Lmxlbmd0aCA+IDAgJiYgdFt0Lmxlbmd0aCAtIDFdKSAmJiAob3BbMF0gPT09IDYgfHwgb3BbMF0gPT09IDIpKSB7IF8gPSAwOyBjb250aW51ZTsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gMyAmJiAoIXQgfHwgKG9wWzFdID4gdFswXSAmJiBvcFsxXSA8IHRbM10pKSkgeyBfLmxhYmVsID0gb3BbMV07IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSA2ICYmIF8ubGFiZWwgPCB0WzFdKSB7IF8ubGFiZWwgPSB0WzFdOyB0ID0gb3A7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHQgJiYgXy5sYWJlbCA8IHRbMl0pIHsgXy5sYWJlbCA9IHRbMl07IF8ub3BzLnB1c2gob3ApOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0WzJdKSBfLm9wcy5wb3AoKTtcclxuICAgICAgICAgICAgICAgICAgICBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIG9wID0gYm9keS5jYWxsKHRoaXNBcmcsIF8pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHsgb3AgPSBbNiwgZV07IHkgPSAwOyB9IGZpbmFsbHkgeyBmID0gdCA9IDA7IH1cclxuICAgICAgICBpZiAob3BbMF0gJiA1KSB0aHJvdyBvcFsxXTsgcmV0dXJuIHsgdmFsdWU6IG9wWzBdID8gb3BbMV0gOiB2b2lkIDAsIGRvbmU6IHRydWUgfTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2NyZWF0ZUJpbmRpbmcgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgdmFyIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG0sIGspO1xyXG4gICAgaWYgKCFkZXNjIHx8IChcImdldFwiIGluIGRlc2MgPyAhbS5fX2VzTW9kdWxlIDogZGVzYy53cml0YWJsZSB8fCBkZXNjLmNvbmZpZ3VyYWJsZSkpIHtcclxuICAgICAgICBkZXNjID0geyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gbVtrXTsgfSB9O1xyXG4gICAgfVxyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIGsyLCBkZXNjKTtcclxufSkgOiAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICBvW2syXSA9IG1ba107XHJcbn0pO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXhwb3J0U3RhcihtLCBvKSB7XHJcbiAgICBmb3IgKHZhciBwIGluIG0pIGlmIChwICE9PSBcImRlZmF1bHRcIiAmJiAhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG8sIHApKSBfX2NyZWF0ZUJpbmRpbmcobywgbSwgcCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3ZhbHVlcyhvKSB7XHJcbiAgICB2YXIgcyA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBTeW1ib2wuaXRlcmF0b3IsIG0gPSBzICYmIG9bc10sIGkgPSAwO1xyXG4gICAgaWYgKG0pIHJldHVybiBtLmNhbGwobyk7XHJcbiAgICBpZiAobyAmJiB0eXBlb2Ygby5sZW5ndGggPT09IFwibnVtYmVyXCIpIHJldHVybiB7XHJcbiAgICAgICAgbmV4dDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAobyAmJiBpID49IG8ubGVuZ3RoKSBvID0gdm9pZCAwO1xyXG4gICAgICAgICAgICByZXR1cm4geyB2YWx1ZTogbyAmJiBvW2krK10sIGRvbmU6ICFvIH07XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IocyA/IFwiT2JqZWN0IGlzIG5vdCBpdGVyYWJsZS5cIiA6IFwiU3ltYm9sLml0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVhZChvLCBuKSB7XHJcbiAgICB2YXIgbSA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvW1N5bWJvbC5pdGVyYXRvcl07XHJcbiAgICBpZiAoIW0pIHJldHVybiBvO1xyXG4gICAgdmFyIGkgPSBtLmNhbGwobyksIHIsIGFyID0gW10sIGU7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIHdoaWxlICgobiA9PT0gdm9pZCAwIHx8IG4tLSA+IDApICYmICEociA9IGkubmV4dCgpKS5kb25lKSBhci5wdXNoKHIudmFsdWUpO1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggKGVycm9yKSB7IGUgPSB7IGVycm9yOiBlcnJvciB9OyB9XHJcbiAgICBmaW5hbGx5IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBpZiAociAmJiAhci5kb25lICYmIChtID0gaVtcInJldHVyblwiXSkpIG0uY2FsbChpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZmluYWxseSB7IGlmIChlKSB0aHJvdyBlLmVycm9yOyB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYXI7XHJcbn1cclxuXHJcbi8qKiBAZGVwcmVjYXRlZCAqL1xyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWQoKSB7XHJcbiAgICBmb3IgKHZhciBhciA9IFtdLCBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKylcclxuICAgICAgICBhciA9IGFyLmNvbmNhdChfX3JlYWQoYXJndW1lbnRzW2ldKSk7XHJcbiAgICByZXR1cm4gYXI7XHJcbn1cclxuXHJcbi8qKiBAZGVwcmVjYXRlZCAqL1xyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheXMoKSB7XHJcbiAgICBmb3IgKHZhciBzID0gMCwgaSA9IDAsIGlsID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGlsOyBpKyspIHMgKz0gYXJndW1lbnRzW2ldLmxlbmd0aDtcclxuICAgIGZvciAodmFyIHIgPSBBcnJheShzKSwgayA9IDAsIGkgPSAwOyBpIDwgaWw7IGkrKylcclxuICAgICAgICBmb3IgKHZhciBhID0gYXJndW1lbnRzW2ldLCBqID0gMCwgamwgPSBhLmxlbmd0aDsgaiA8IGpsOyBqKyssIGsrKylcclxuICAgICAgICAgICAgcltrXSA9IGFbal07XHJcbiAgICByZXR1cm4gcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXkodG8sIGZyb20sIHBhY2spIHtcclxuICAgIGlmIChwYWNrIHx8IGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIGZvciAodmFyIGkgPSAwLCBsID0gZnJvbS5sZW5ndGgsIGFyOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgaWYgKGFyIHx8ICEoaSBpbiBmcm9tKSkge1xyXG4gICAgICAgICAgICBpZiAoIWFyKSBhciA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGZyb20sIDAsIGkpO1xyXG4gICAgICAgICAgICBhcltpXSA9IGZyb21baV07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRvLmNvbmNhdChhciB8fCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChmcm9tKSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0KHYpIHtcclxuICAgIHJldHVybiB0aGlzIGluc3RhbmNlb2YgX19hd2FpdCA/ICh0aGlzLnYgPSB2LCB0aGlzKSA6IG5ldyBfX2F3YWl0KHYpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0dlbmVyYXRvcih0aGlzQXJnLCBfYXJndW1lbnRzLCBnZW5lcmF0b3IpIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgZyA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSwgaSwgcSA9IFtdO1xyXG4gICAgcmV0dXJuIGkgPSBPYmplY3QuY3JlYXRlKCh0eXBlb2YgQXN5bmNJdGVyYXRvciA9PT0gXCJmdW5jdGlvblwiID8gQXN5bmNJdGVyYXRvciA6IE9iamVjdCkucHJvdG90eXBlKSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiLCBhd2FpdFJldHVybiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIGF3YWl0UmV0dXJuKGYpIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBQcm9taXNlLnJlc29sdmUodikudGhlbihmLCByZWplY3QpOyB9OyB9XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4sIGYpIHsgaWYgKGdbbl0pIHsgaVtuXSA9IGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAoYSwgYikgeyBxLnB1c2goW24sIHYsIGEsIGJdKSA+IDEgfHwgcmVzdW1lKG4sIHYpOyB9KTsgfTsgaWYgKGYpIGlbbl0gPSBmKGlbbl0pOyB9IH1cclxuICAgIGZ1bmN0aW9uIHJlc3VtZShuLCB2KSB7IHRyeSB7IHN0ZXAoZ1tuXSh2KSk7IH0gY2F0Y2ggKGUpIHsgc2V0dGxlKHFbMF1bM10sIGUpOyB9IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAocikgeyByLnZhbHVlIGluc3RhbmNlb2YgX19hd2FpdCA/IFByb21pc2UucmVzb2x2ZShyLnZhbHVlLnYpLnRoZW4oZnVsZmlsbCwgcmVqZWN0KSA6IHNldHRsZShxWzBdWzJdLCByKTsgfVxyXG4gICAgZnVuY3Rpb24gZnVsZmlsbCh2YWx1ZSkgeyByZXN1bWUoXCJuZXh0XCIsIHZhbHVlKTsgfVxyXG4gICAgZnVuY3Rpb24gcmVqZWN0KHZhbHVlKSB7IHJlc3VtZShcInRocm93XCIsIHZhbHVlKTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKGYsIHYpIHsgaWYgKGYodiksIHEuc2hpZnQoKSwgcS5sZW5ndGgpIHJlc3VtZShxWzBdWzBdLCBxWzBdWzFdKTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0RlbGVnYXRvcihvKSB7XHJcbiAgICB2YXIgaSwgcDtcclxuICAgIHJldHVybiBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiwgZnVuY3Rpb24gKGUpIHsgdGhyb3cgZTsgfSksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4sIGYpIHsgaVtuXSA9IG9bbl0gPyBmdW5jdGlvbiAodikgeyByZXR1cm4gKHAgPSAhcCkgPyB7IHZhbHVlOiBfX2F3YWl0KG9bbl0odikpLCBkb25lOiBmYWxzZSB9IDogZiA/IGYodikgOiB2OyB9IDogZjsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY1ZhbHVlcyhvKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIG0gPSBvW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSwgaTtcclxuICAgIHJldHVybiBtID8gbS5jYWxsKG8pIDogKG8gPSB0eXBlb2YgX192YWx1ZXMgPT09IFwiZnVuY3Rpb25cIiA/IF9fdmFsdWVzKG8pIDogb1tTeW1ib2wuaXRlcmF0b3JdKCksIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpKTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyBpW25dID0gb1tuXSAmJiBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkgeyB2ID0gb1tuXSh2KSwgc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgdi5kb25lLCB2LnZhbHVlKTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShyZXNvbHZlLCByZWplY3QsIGQsIHYpIHsgUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZnVuY3Rpb24odikgeyByZXNvbHZlKHsgdmFsdWU6IHYsIGRvbmU6IGQgfSk7IH0sIHJlamVjdCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWFrZVRlbXBsYXRlT2JqZWN0KGNvb2tlZCwgcmF3KSB7XHJcbiAgICBpZiAoT2JqZWN0LmRlZmluZVByb3BlcnR5KSB7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb29rZWQsIFwicmF3XCIsIHsgdmFsdWU6IHJhdyB9KTsgfSBlbHNlIHsgY29va2VkLnJhdyA9IHJhdzsgfVxyXG4gICAgcmV0dXJuIGNvb2tlZDtcclxufTtcclxuXHJcbnZhciBfX3NldE1vZHVsZURlZmF1bHQgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBcImRlZmF1bHRcIiwgeyBlbnVtZXJhYmxlOiB0cnVlLCB2YWx1ZTogdiB9KTtcclxufSkgOiBmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBvW1wiZGVmYXVsdFwiXSA9IHY7XHJcbn07XHJcblxyXG52YXIgb3duS2V5cyA9IGZ1bmN0aW9uKG8pIHtcclxuICAgIG93bktleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyB8fCBmdW5jdGlvbiAobykge1xyXG4gICAgICAgIHZhciBhciA9IFtdO1xyXG4gICAgICAgIGZvciAodmFyIGsgaW4gbykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvLCBrKSkgYXJbYXIubGVuZ3RoXSA9IGs7XHJcbiAgICAgICAgcmV0dXJuIGFyO1xyXG4gICAgfTtcclxuICAgIHJldHVybiBvd25LZXlzKG8pO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9faW1wb3J0U3Rhcihtb2QpIHtcclxuICAgIGlmIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpIHJldHVybiBtb2Q7XHJcbiAgICB2YXIgcmVzdWx0ID0ge307XHJcbiAgICBpZiAobW9kICE9IG51bGwpIGZvciAodmFyIGsgPSBvd25LZXlzKG1vZCksIGkgPSAwOyBpIDwgay5sZW5ndGg7IGkrKykgaWYgKGtbaV0gIT09IFwiZGVmYXVsdFwiKSBfX2NyZWF0ZUJpbmRpbmcocmVzdWx0LCBtb2QsIGtbaV0pO1xyXG4gICAgX19zZXRNb2R1bGVEZWZhdWx0KHJlc3VsdCwgbW9kKTtcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydERlZmF1bHQobW9kKSB7XHJcbiAgICByZXR1cm4gKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgPyBtb2QgOiB7IGRlZmF1bHQ6IG1vZCB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZEdldChyZWNlaXZlciwgc3RhdGUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIGdldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHJlYWQgcHJpdmF0ZSBtZW1iZXIgZnJvbSBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xyXG4gICAgcmV0dXJuIGtpbmQgPT09IFwibVwiID8gZiA6IGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyKSA6IGYgPyBmLnZhbHVlIDogc3RhdGUuZ2V0KHJlY2VpdmVyKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRTZXQocmVjZWl2ZXIsIHN0YXRlLCB2YWx1ZSwga2luZCwgZikge1xyXG4gICAgaWYgKGtpbmQgPT09IFwibVwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBtZXRob2QgaXMgbm90IHdyaXRhYmxlXCIpO1xyXG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgc2V0dGVyXCIpO1xyXG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3Qgd3JpdGUgcHJpdmF0ZSBtZW1iZXIgdG8gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiAoa2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIsIHZhbHVlKSA6IGYgPyBmLnZhbHVlID0gdmFsdWUgOiBzdGF0ZS5zZXQocmVjZWl2ZXIsIHZhbHVlKSksIHZhbHVlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZEluKHN0YXRlLCByZWNlaXZlcikge1xyXG4gICAgaWYgKHJlY2VpdmVyID09PSBudWxsIHx8ICh0eXBlb2YgcmVjZWl2ZXIgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHJlY2VpdmVyICE9PSBcImZ1bmN0aW9uXCIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHVzZSAnaW4nIG9wZXJhdG9yIG9uIG5vbi1vYmplY3RcIik7XHJcbiAgICByZXR1cm4gdHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciA9PT0gc3RhdGUgOiBzdGF0ZS5oYXMocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hZGREaXNwb3NhYmxlUmVzb3VyY2UoZW52LCB2YWx1ZSwgYXN5bmMpIHtcclxuICAgIGlmICh2YWx1ZSAhPT0gbnVsbCAmJiB2YWx1ZSAhPT0gdm9pZCAwKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgdmFsdWUgIT09IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBleHBlY3RlZC5cIik7XHJcbiAgICAgICAgdmFyIGRpc3Bvc2UsIGlubmVyO1xyXG4gICAgICAgIGlmIChhc3luYykge1xyXG4gICAgICAgICAgICBpZiAoIVN5bWJvbC5hc3luY0Rpc3Bvc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNEaXNwb3NlIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgICAgICAgICAgZGlzcG9zZSA9IHZhbHVlW1N5bWJvbC5hc3luY0Rpc3Bvc2VdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZGlzcG9zZSA9PT0gdm9pZCAwKSB7XHJcbiAgICAgICAgICAgIGlmICghU3ltYm9sLmRpc3Bvc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuZGlzcG9zZSBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICAgICAgICAgIGRpc3Bvc2UgPSB2YWx1ZVtTeW1ib2wuZGlzcG9zZV07XHJcbiAgICAgICAgICAgIGlmIChhc3luYykgaW5uZXIgPSBkaXNwb3NlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHlwZW9mIGRpc3Bvc2UgIT09IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBub3QgZGlzcG9zYWJsZS5cIik7XHJcbiAgICAgICAgaWYgKGlubmVyKSBkaXNwb3NlID0gZnVuY3Rpb24oKSB7IHRyeSB7IGlubmVyLmNhbGwodGhpcyk7IH0gY2F0Y2ggKGUpIHsgcmV0dXJuIFByb21pc2UucmVqZWN0KGUpOyB9IH07XHJcbiAgICAgICAgZW52LnN0YWNrLnB1c2goeyB2YWx1ZTogdmFsdWUsIGRpc3Bvc2U6IGRpc3Bvc2UsIGFzeW5jOiBhc3luYyB9KTtcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKGFzeW5jKSB7XHJcbiAgICAgICAgZW52LnN0YWNrLnB1c2goeyBhc3luYzogdHJ1ZSB9KTtcclxuICAgIH1cclxuICAgIHJldHVybiB2YWx1ZTtcclxuXHJcbn1cclxuXHJcbnZhciBfU3VwcHJlc3NlZEVycm9yID0gdHlwZW9mIFN1cHByZXNzZWRFcnJvciA9PT0gXCJmdW5jdGlvblwiID8gU3VwcHJlc3NlZEVycm9yIDogZnVuY3Rpb24gKGVycm9yLCBzdXBwcmVzc2VkLCBtZXNzYWdlKSB7XHJcbiAgICB2YXIgZSA9IG5ldyBFcnJvcihtZXNzYWdlKTtcclxuICAgIHJldHVybiBlLm5hbWUgPSBcIlN1cHByZXNzZWRFcnJvclwiLCBlLmVycm9yID0gZXJyb3IsIGUuc3VwcHJlc3NlZCA9IHN1cHByZXNzZWQsIGU7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19kaXNwb3NlUmVzb3VyY2VzKGVudikge1xyXG4gICAgZnVuY3Rpb24gZmFpbChlKSB7XHJcbiAgICAgICAgZW52LmVycm9yID0gZW52Lmhhc0Vycm9yID8gbmV3IF9TdXBwcmVzc2VkRXJyb3IoZSwgZW52LmVycm9yLCBcIkFuIGVycm9yIHdhcyBzdXBwcmVzc2VkIGR1cmluZyBkaXNwb3NhbC5cIikgOiBlO1xyXG4gICAgICAgIGVudi5oYXNFcnJvciA9IHRydWU7XHJcbiAgICB9XHJcbiAgICB2YXIgciwgcyA9IDA7XHJcbiAgICBmdW5jdGlvbiBuZXh0KCkge1xyXG4gICAgICAgIHdoaWxlIChyID0gZW52LnN0YWNrLnBvcCgpKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXIuYXN5bmMgJiYgcyA9PT0gMSkgcmV0dXJuIHMgPSAwLCBlbnYuc3RhY2sucHVzaChyKSwgUHJvbWlzZS5yZXNvbHZlKCkudGhlbihuZXh0KTtcclxuICAgICAgICAgICAgICAgIGlmIChyLmRpc3Bvc2UpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzdWx0ID0gci5kaXNwb3NlLmNhbGwoci52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHIuYXN5bmMpIHJldHVybiBzIHw9IDIsIFByb21pc2UucmVzb2x2ZShyZXN1bHQpLnRoZW4obmV4dCwgZnVuY3Rpb24oZSkgeyBmYWlsKGUpOyByZXR1cm4gbmV4dCgpOyB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2UgcyB8PSAxO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICBmYWlsKGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChzID09PSAxKSByZXR1cm4gZW52Lmhhc0Vycm9yID8gUHJvbWlzZS5yZWplY3QoZW52LmVycm9yKSA6IFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICAgIGlmIChlbnYuaGFzRXJyb3IpIHRocm93IGVudi5lcnJvcjtcclxuICAgIH1cclxuICAgIHJldHVybiBuZXh0KCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Jld3JpdGVSZWxhdGl2ZUltcG9ydEV4dGVuc2lvbihwYXRoLCBwcmVzZXJ2ZUpzeCwgZXh0cmFFeHRlbnNpb25zLCBpZ25vcmVDYXNlKSB7XHJcbiAgICBpZiAodHlwZW9mIHBhdGggPT09IFwic3RyaW5nXCIgJiYgL15cXC5cXC4/XFwvLy50ZXN0KHBhdGgpKSB7XHJcbiAgICAgICAgaWYgKGV4dHJhRXh0ZW5zaW9ucykge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBleHRlbnNpb24gaW4gZXh0cmFFeHRlbnNpb25zKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgc3VmZml4ID0gcGF0aC5zbGljZSgtZXh0ZW5zaW9uLmxlbmd0aCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoc3VmZml4ID09PSBleHRlbnNpb24gfHwgaWdub3JlQ2FzZSAmJiBzdWZmaXgudG9Mb3dlckNhc2UoKSA9PT0gZXh0ZW5zaW9uLnRvTG93ZXJDYXNlKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgb3V0cHV0ID0gZXh0cmFFeHRlbnNpb25zW2V4dGVuc2lvbl07XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG91dHB1dCA9PT0gZXh0ZW5zaW9uID8gcGF0aCA6IHBhdGguc2xpY2UoMCwgLWV4dGVuc2lvbi5sZW5ndGgpICsgb3V0cHV0O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBwYXRoLnJlcGxhY2UoL1xcLih0c3gpJHwoKD86XFwuZCk/KSgoPzpcXC5bXi4vXSs/KT8pXFwuKFtjbV0/KXRzJC9pLCBmdW5jdGlvbiAobSwgdHN4LCBkLCBleHQsIGNtKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0c3ggPyBwcmVzZXJ2ZUpzeCA/IFwiLmpzeFwiIDogXCIuanNcIiA6IGQgJiYgKCFleHQgfHwgIWNtKSA/IG0gOiAoZCArIGV4dCArIFwiLlwiICsgY20udG9Mb3dlckNhc2UoKSArIFwianNcIik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcGF0aDtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQge1xyXG4gICAgX19leHRlbmRzOiBfX2V4dGVuZHMsXHJcbiAgICBfX2Fzc2lnbjogX19hc3NpZ24sXHJcbiAgICBfX3Jlc3Q6IF9fcmVzdCxcclxuICAgIF9fZGVjb3JhdGU6IF9fZGVjb3JhdGUsXHJcbiAgICBfX3BhcmFtOiBfX3BhcmFtLFxyXG4gICAgX19lc0RlY29yYXRlOiBfX2VzRGVjb3JhdGUsXHJcbiAgICBfX3J1bkluaXRpYWxpemVyczogX19ydW5Jbml0aWFsaXplcnMsXHJcbiAgICBfX3Byb3BLZXk6IF9fcHJvcEtleSxcclxuICAgIF9fc2V0RnVuY3Rpb25OYW1lOiBfX3NldEZ1bmN0aW9uTmFtZSxcclxuICAgIF9fbWV0YWRhdGE6IF9fbWV0YWRhdGEsXHJcbiAgICBfX2F3YWl0ZXI6IF9fYXdhaXRlcixcclxuICAgIF9fZ2VuZXJhdG9yOiBfX2dlbmVyYXRvcixcclxuICAgIF9fY3JlYXRlQmluZGluZzogX19jcmVhdGVCaW5kaW5nLFxyXG4gICAgX19leHBvcnRTdGFyOiBfX2V4cG9ydFN0YXIsXHJcbiAgICBfX3ZhbHVlczogX192YWx1ZXMsXHJcbiAgICBfX3JlYWQ6IF9fcmVhZCxcclxuICAgIF9fc3ByZWFkOiBfX3NwcmVhZCxcclxuICAgIF9fc3ByZWFkQXJyYXlzOiBfX3NwcmVhZEFycmF5cyxcclxuICAgIF9fc3ByZWFkQXJyYXk6IF9fc3ByZWFkQXJyYXksXHJcbiAgICBfX2F3YWl0OiBfX2F3YWl0LFxyXG4gICAgX19hc3luY0dlbmVyYXRvcjogX19hc3luY0dlbmVyYXRvcixcclxuICAgIF9fYXN5bmNEZWxlZ2F0b3I6IF9fYXN5bmNEZWxlZ2F0b3IsXHJcbiAgICBfX2FzeW5jVmFsdWVzOiBfX2FzeW5jVmFsdWVzLFxyXG4gICAgX19tYWtlVGVtcGxhdGVPYmplY3Q6IF9fbWFrZVRlbXBsYXRlT2JqZWN0LFxyXG4gICAgX19pbXBvcnRTdGFyOiBfX2ltcG9ydFN0YXIsXHJcbiAgICBfX2ltcG9ydERlZmF1bHQ6IF9faW1wb3J0RGVmYXVsdCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQ6IF9fY2xhc3NQcml2YXRlRmllbGRHZXQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0OiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZEluOiBfX2NsYXNzUHJpdmF0ZUZpZWxkSW4sXHJcbiAgICBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZTogX19hZGREaXNwb3NhYmxlUmVzb3VyY2UsXHJcbiAgICBfX2Rpc3Bvc2VSZXNvdXJjZXM6IF9fZGlzcG9zZVJlc291cmNlcyxcclxuICAgIF9fcmV3cml0ZVJlbGF0aXZlSW1wb3J0RXh0ZW5zaW9uOiBfX3Jld3JpdGVSZWxhdGl2ZUltcG9ydEV4dGVuc2lvbixcclxufTtcclxuIiwiaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4vT3BlcmF0aW9uXCI7XG5cbmltcG9ydCB7IExpc3RMaW5lLCBQb3NpdGlvbiwgUm9vdCB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBNb3ZlQ3Vyc29yVG9QcmV2aW91c1VuZm9sZGVkTGluZSBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gIHByaXZhdGUgdXBkYXRlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdDogUm9vdCkge31cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcFByb3BhZ2F0aW9uO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlKCkge1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZWQ7XG4gIH1cblxuICBwZXJmb3JtKCkge1xuICAgIGNvbnN0IHsgcm9vdCB9ID0gdGhpcztcblxuICAgIGlmICghcm9vdC5oYXNTaW5nbGVDdXJzb3IoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxpc3QgPSB0aGlzLnJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgY29uc3QgY3Vyc29yID0gdGhpcy5yb290LmdldEN1cnNvcigpO1xuICAgIGNvbnN0IGxpbmVzID0gbGlzdC5nZXRMaW5lc0luZm8oKTtcbiAgICBjb25zdCBsaW5lTm8gPSBsaW5lcy5maW5kSW5kZXgoKGwpID0+IHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIGN1cnNvci5jaCA9PT0gbC5mcm9tLmNoICsgbGlzdC5nZXRDaGVja2JveExlbmd0aCgpICYmXG4gICAgICAgIGN1cnNvci5saW5lID09PSBsLmZyb20ubGluZVxuICAgICAgKTtcbiAgICB9KTtcblxuICAgIGlmIChsaW5lTm8gPT09IDApIHtcbiAgICAgIHRoaXMubW92ZUN1cnNvclRvUHJldmlvdXNVbmZvbGRlZEl0ZW0ocm9vdCwgY3Vyc29yKTtcbiAgICB9IGVsc2UgaWYgKGxpbmVObyA+IDApIHtcbiAgICAgIHRoaXMubW92ZUN1cnNvclRvUHJldmlvdXNOb3RlTGluZShyb290LCBsaW5lcywgbGluZU5vKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIG1vdmVDdXJzb3JUb1ByZXZpb3VzTm90ZUxpbmUoXG4gICAgcm9vdDogUm9vdCxcbiAgICBsaW5lczogTGlzdExpbmVbXSxcbiAgICBsaW5lTm86IG51bWJlcixcbiAgKSB7XG4gICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG5cbiAgICByb290LnJlcGxhY2VDdXJzb3IobGluZXNbbGluZU5vIC0gMV0udG8pO1xuICB9XG5cbiAgcHJpdmF0ZSBtb3ZlQ3Vyc29yVG9QcmV2aW91c1VuZm9sZGVkSXRlbShyb290OiBSb290LCBjdXJzb3I6IFBvc2l0aW9uKSB7XG4gICAgY29uc3QgcHJldiA9IHJvb3QuZ2V0TGlzdFVuZGVyTGluZShjdXJzb3IubGluZSAtIDEpO1xuXG4gICAgaWYgKCFwcmV2KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG5cbiAgICBpZiAocHJldi5pc0ZvbGRlZCgpKSB7XG4gICAgICBjb25zdCBmb2xkUm9vdCA9IHByZXYuZ2V0VG9wRm9sZFJvb3QoKTtcbiAgICAgIGNvbnN0IGZpcnN0TGluZUVuZCA9IGZvbGRSb290LmdldExpbmVzSW5mbygpWzBdLnRvO1xuICAgICAgcm9vdC5yZXBsYWNlQ3Vyc29yKGZpcnN0TGluZUVuZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJvb3QucmVwbGFjZUN1cnNvcihwcmV2LmdldExhc3RMaW5lQ29udGVudEVuZCgpKTtcbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCB7IEVkaXRvciwgZWRpdG9ySW5mb0ZpZWxkIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7XG4gIGZvbGRFZmZlY3QsXG4gIGZvbGRhYmxlLFxuICBmb2xkZWRSYW5nZXMsXG4gIHVuZm9sZEVmZmVjdCxcbn0gZnJvbSBcIkBjb2RlbWlycm9yL2xhbmd1YWdlXCI7XG5pbXBvcnQgeyBFZGl0b3JTdGF0ZSB9IGZyb20gXCJAY29kZW1pcnJvci9zdGF0ZVwiO1xuaW1wb3J0IHsgRWRpdG9yVmlldywgcnVuU2NvcGVIYW5kbGVycyB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmV4cG9ydCBjbGFzcyBNeUVkaXRvclBvc2l0aW9uIHtcbiAgbGluZTogbnVtYmVyO1xuICBjaDogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgTXlFZGl0b3JSYW5nZSB7XG4gIGZyb206IE15RWRpdG9yUG9zaXRpb247XG4gIHRvOiBNeUVkaXRvclBvc2l0aW9uO1xufVxuXG5leHBvcnQgY2xhc3MgTXlFZGl0b3JTZWxlY3Rpb24ge1xuICBhbmNob3I6IE15RWRpdG9yUG9zaXRpb247XG4gIGhlYWQ6IE15RWRpdG9yUG9zaXRpb247XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRFZGl0b3JGcm9tU3RhdGUoc3RhdGU6IEVkaXRvclN0YXRlKSB7XG4gIGNvbnN0IHsgZWRpdG9yIH0gPSBzdGF0ZS5maWVsZChlZGl0b3JJbmZvRmllbGQpO1xuXG4gIGlmICghZWRpdG9yKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gbmV3IE15RWRpdG9yKGVkaXRvcik7XG59XG5cbmRlY2xhcmUgZ2xvYmFsIHtcbiAgaW50ZXJmYWNlIFdpbmRvdyB7XG4gICAgT2JzaWRpYW5ab29tUGx1Z2luPzoge1xuICAgICAgZ2V0Wm9vbVJhbmdlKGU6IEVkaXRvcik6IE15RWRpdG9yUmFuZ2U7XG4gICAgICB6b29tT3V0KGU6IEVkaXRvcik6IHZvaWQ7XG4gICAgICB6b29tSW4oZTogRWRpdG9yLCBsaW5lOiBudW1iZXIpOiB2b2lkO1xuICAgICAgcmVmcmVzaFpvb20/KGU6IEVkaXRvcik6IHZvaWQ7XG4gICAgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBmb2xkSW5zaWRlKHZpZXc6IEVkaXRvclZpZXcsIGZyb206IG51bWJlciwgdG86IG51bWJlcikge1xuICBsZXQgZm91bmQ6IHsgZnJvbTogbnVtYmVyOyB0bzogbnVtYmVyIH0gfCBudWxsID0gbnVsbDtcbiAgZm9sZGVkUmFuZ2VzKHZpZXcuc3RhdGUpLmJldHdlZW4oZnJvbSwgdG8sIChmcm9tLCB0bykgPT4ge1xuICAgIGlmICghZm91bmQgfHwgZm91bmQuZnJvbSA+IGZyb20pIGZvdW5kID0geyBmcm9tLCB0byB9O1xuICB9KTtcbiAgcmV0dXJuIGZvdW5kO1xufVxuXG5leHBvcnQgY2xhc3MgTXlFZGl0b3Ige1xuICBwcml2YXRlIHZpZXc6IEVkaXRvclZpZXc7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBlOiBFZGl0b3IpIHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIHRoaXMudmlldyA9ICh0aGlzLmUgYXMgYW55KS5jbTtcbiAgfVxuXG4gIGdldEN1cnNvcigpOiBNeUVkaXRvclBvc2l0aW9uIHtcbiAgICByZXR1cm4gdGhpcy5lLmdldEN1cnNvcigpO1xuICB9XG5cbiAgZ2V0TGluZShuOiBudW1iZXIpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmUuZ2V0TGluZShuKTtcbiAgfVxuXG4gIGxhc3RMaW5lKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuZS5sYXN0TGluZSgpO1xuICB9XG5cbiAgbGlzdFNlbGVjdGlvbnMoKTogTXlFZGl0b3JTZWxlY3Rpb25bXSB7XG4gICAgcmV0dXJuIHRoaXMuZS5saXN0U2VsZWN0aW9ucygpO1xuICB9XG5cbiAgZ2V0UmFuZ2UoZnJvbTogTXlFZGl0b3JQb3NpdGlvbiwgdG86IE15RWRpdG9yUG9zaXRpb24pOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmUuZ2V0UmFuZ2UoZnJvbSwgdG8pO1xuICB9XG5cbiAgcmVwbGFjZVJhbmdlKFxuICAgIHJlcGxhY2VtZW50OiBzdHJpbmcsXG4gICAgZnJvbTogTXlFZGl0b3JQb3NpdGlvbixcbiAgICB0bzogTXlFZGl0b3JQb3NpdGlvbixcbiAgKTogdm9pZCB7XG4gICAgcmV0dXJuIHRoaXMuZS5yZXBsYWNlUmFuZ2UocmVwbGFjZW1lbnQsIGZyb20sIHRvKTtcbiAgfVxuXG4gIHNldFNlbGVjdGlvbnMoc2VsZWN0aW9uczogTXlFZGl0b3JTZWxlY3Rpb25bXSk6IHZvaWQge1xuICAgIHRoaXMuZS5zZXRTZWxlY3Rpb25zKHNlbGVjdGlvbnMpO1xuICB9XG5cbiAgc2V0VmFsdWUodGV4dDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5lLnNldFZhbHVlKHRleHQpO1xuICB9XG5cbiAgZ2V0VmFsdWUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5lLmdldFZhbHVlKCk7XG4gIH1cblxuICBvZmZzZXRUb1BvcyhvZmZzZXQ6IG51bWJlcik6IE15RWRpdG9yUG9zaXRpb24ge1xuICAgIHJldHVybiB0aGlzLmUub2Zmc2V0VG9Qb3Mob2Zmc2V0KTtcbiAgfVxuXG4gIHBvc1RvT2Zmc2V0KHBvczogTXlFZGl0b3JQb3NpdGlvbik6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuZS5wb3NUb09mZnNldChwb3MpO1xuICB9XG5cbiAgZm9sZChuOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCB7IHZpZXcgfSA9IHRoaXM7XG4gICAgY29uc3QgbCA9IHZpZXcubGluZUJsb2NrQXQodmlldy5zdGF0ZS5kb2MubGluZShuICsgMSkuZnJvbSk7XG4gICAgY29uc3QgcmFuZ2UgPSBmb2xkYWJsZSh2aWV3LnN0YXRlLCBsLmZyb20sIGwudG8pO1xuXG4gICAgaWYgKCFyYW5nZSB8fCByYW5nZS5mcm9tID09PSByYW5nZS50bykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZpZXcuZGlzcGF0Y2goeyBlZmZlY3RzOiBbZm9sZEVmZmVjdC5vZihyYW5nZSldIH0pO1xuICB9XG5cbiAgdW5mb2xkKG46IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IHsgdmlldyB9ID0gdGhpcztcbiAgICBjb25zdCBsID0gdmlldy5saW5lQmxvY2tBdCh2aWV3LnN0YXRlLmRvYy5saW5lKG4gKyAxKS5mcm9tKTtcbiAgICBjb25zdCByYW5nZSA9IGZvbGRJbnNpZGUodmlldywgbC5mcm9tLCBsLnRvKTtcblxuICAgIGlmICghcmFuZ2UpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2aWV3LmRpc3BhdGNoKHsgZWZmZWN0czogW3VuZm9sZEVmZmVjdC5vZihyYW5nZSldIH0pO1xuICB9XG5cbiAgZ2V0QWxsRm9sZGVkTGluZXMoKTogbnVtYmVyW10ge1xuICAgIGNvbnN0IGMgPSBmb2xkZWRSYW5nZXModGhpcy52aWV3LnN0YXRlKS5pdGVyKCk7XG4gICAgY29uc3QgcmVzOiBudW1iZXJbXSA9IFtdO1xuICAgIHdoaWxlIChjLnZhbHVlKSB7XG4gICAgICByZXMucHVzaCh0aGlzLm9mZnNldFRvUG9zKGMuZnJvbSkubGluZSk7XG4gICAgICBjLm5leHQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfVxuXG4gIHRyaWdnZXJPbktleURvd24oZTogS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuICAgIHJ1blNjb3BlSGFuZGxlcnModGhpcy52aWV3LCBlLCBcImVkaXRvclwiKTtcbiAgfVxuXG4gIGdldFpvb21SYW5nZSgpOiBNeUVkaXRvclJhbmdlIHwgbnVsbCB7XG4gICAgaWYgKCF3aW5kb3cuT2JzaWRpYW5ab29tUGx1Z2luKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gd2luZG93Lk9ic2lkaWFuWm9vbVBsdWdpbi5nZXRab29tUmFuZ2UodGhpcy5lKTtcbiAgfVxuXG4gIHpvb21PdXQoKSB7XG4gICAgaWYgKCF3aW5kb3cuT2JzaWRpYW5ab29tUGx1Z2luKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgd2luZG93Lk9ic2lkaWFuWm9vbVBsdWdpbi56b29tT3V0KHRoaXMuZSk7XG4gIH1cblxuICB6b29tSW4obGluZTogbnVtYmVyKSB7XG4gICAgaWYgKCF3aW5kb3cuT2JzaWRpYW5ab29tUGx1Z2luKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgd2luZG93Lk9ic2lkaWFuWm9vbVBsdWdpbi56b29tSW4odGhpcy5lLCBsaW5lKTtcbiAgfVxuXG4gIHRyeVJlZnJlc2hab29tKGxpbmU6IG51bWJlcikge1xuICAgIGlmICghd2luZG93Lk9ic2lkaWFuWm9vbVBsdWdpbikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh3aW5kb3cuT2JzaWRpYW5ab29tUGx1Z2luLnJlZnJlc2hab29tKSB7XG4gICAgICB3aW5kb3cuT2JzaWRpYW5ab29tUGx1Z2luLnJlZnJlc2hab29tKHRoaXMuZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdpbmRvdy5PYnNpZGlhblpvb21QbHVnaW4uem9vbUluKHRoaXMuZSwgbGluZSk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBFZGl0b3JWaWV3IH0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IsIGdldEVkaXRvckZyb21TdGF0ZSB9IGZyb20gXCIuLi9lZGl0b3JcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKGNvbmZpZzoge1xuICBjaGVjaz86IChlZGl0b3I6IE15RWRpdG9yKSA9PiBib29sZWFuO1xuICBydW46IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgc2hvdWxkVXBkYXRlOiBib29sZWFuO1xuICAgIHNob3VsZFN0b3BQcm9wYWdhdGlvbjogYm9vbGVhbjtcbiAgfTtcbn0pIHtcbiAgY29uc3QgY2hlY2sgPSBjb25maWcuY2hlY2sgfHwgKCgpID0+IHRydWUpO1xuICBjb25zdCB7IHJ1biB9ID0gY29uZmlnO1xuXG4gIHJldHVybiAodmlldzogRWRpdG9yVmlldyk6IGJvb2xlYW4gPT4ge1xuICAgIGNvbnN0IGVkaXRvciA9IGdldEVkaXRvckZyb21TdGF0ZSh2aWV3LnN0YXRlKTtcblxuICAgIGlmICghY2hlY2soZWRpdG9yKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IHsgc2hvdWxkVXBkYXRlLCBzaG91bGRTdG9wUHJvcGFnYXRpb24gfSA9IHJ1bihlZGl0b3IpO1xuXG4gICAgcmV0dXJuIHNob3VsZFVwZGF0ZSB8fCBzaG91bGRTdG9wUHJvcGFnYXRpb247XG4gIH07XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsga2V5bWFwIH0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBNb3ZlQ3Vyc29yVG9QcmV2aW91c1VuZm9sZGVkTGluZSB9IGZyb20gXCIuLi9vcGVyYXRpb25zL01vdmVDdXJzb3JUb1ByZXZpb3VzVW5mb2xkZWRMaW5lXCI7XG5pbXBvcnQgeyBJTUVEZXRlY3RvciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9JTUVEZXRlY3RvclwiO1xuaW1wb3J0IHsgT3BlcmF0aW9uUGVyZm9ybWVyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09wZXJhdGlvblBlcmZvcm1lclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcbmltcG9ydCB7IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrIH0gZnJvbSBcIi4uL3V0aWxzL2NyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrXCI7XG5cbmV4cG9ydCBjbGFzcyBBcnJvd0xlZnRBbmRDdHJsQXJyb3dMZWZ0QmVoYXZpb3VyT3ZlcnJpZGUgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbixcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgICBwcml2YXRlIGltZURldGVjdG9yOiBJTUVEZXRlY3RvcixcbiAgICBwcml2YXRlIG9wZXJhdGlvblBlcmZvcm1lcjogT3BlcmF0aW9uUGVyZm9ybWVyLFxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihcbiAgICAgIGtleW1hcC5vZihbXG4gICAgICAgIHtcbiAgICAgICAgICBrZXk6IFwiQXJyb3dMZWZ0XCIsXG4gICAgICAgICAgcnVuOiBjcmVhdGVLZXltYXBSdW5DYWxsYmFjayh7XG4gICAgICAgICAgICBjaGVjazogdGhpcy5jaGVjayxcbiAgICAgICAgICAgIHJ1bjogdGhpcy5ydW4sXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB3aW46IFwiYy1BcnJvd0xlZnRcIixcbiAgICAgICAgICBsaW51eDogXCJjLUFycm93TGVmdFwiLFxuICAgICAgICAgIHJ1bjogY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2soe1xuICAgICAgICAgICAgY2hlY2s6IHRoaXMuY2hlY2ssXG4gICAgICAgICAgICBydW46IHRoaXMucnVuLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgXSksXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHt9XG5cbiAgcHJpdmF0ZSBjaGVjayA9ICgpID0+IHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5zZXR0aW5ncy5rZWVwQ3Vyc29yV2l0aGluQ29udGVudCAhPT0gXCJuZXZlclwiICYmXG4gICAgICAhdGhpcy5pbWVEZXRlY3Rvci5pc09wZW5lZCgpXG4gICAgKTtcbiAgfTtcblxuICBwcml2YXRlIHJ1biA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLnBlcmZvcm0oXG4gICAgICAocm9vdCkgPT4gbmV3IE1vdmVDdXJzb3JUb1ByZXZpb3VzVW5mb2xkZWRMaW5lKHJvb3QpLFxuICAgICAgZWRpdG9yLFxuICAgICk7XG4gIH07XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gY21wUG9zKGE6IFBvc2l0aW9uLCBiOiBQb3NpdGlvbikge1xuICByZXR1cm4gYS5saW5lIC0gYi5saW5lIHx8IGEuY2ggLSBiLmNoO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF4UG9zKGE6IFBvc2l0aW9uLCBiOiBQb3NpdGlvbikge1xuICByZXR1cm4gY21wUG9zKGEsIGIpIDwgMCA/IGIgOiBhO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWluUG9zKGE6IFBvc2l0aW9uLCBiOiBQb3NpdGlvbikge1xuICByZXR1cm4gY21wUG9zKGEsIGIpIDwgMCA/IGEgOiBiO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNSYW5nZXNJbnRlcnNlY3RzKFxuICBhOiBbUG9zaXRpb24sIFBvc2l0aW9uXSxcbiAgYjogW1Bvc2l0aW9uLCBQb3NpdGlvbl0sXG4pIHtcbiAgcmV0dXJuIGNtcFBvcyhhWzFdLCBiWzBdKSA+PSAwICYmIGNtcFBvcyhhWzBdLCBiWzFdKSA8PSAwO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyhyb290OiBSb290KSB7XG4gIGZ1bmN0aW9uIHZpc2l0KHBhcmVudDogUm9vdCB8IExpc3QpIHtcbiAgICBsZXQgaW5kZXggPSAxO1xuXG4gICAgZm9yIChjb25zdCBjaGlsZCBvZiBwYXJlbnQuZ2V0Q2hpbGRyZW4oKSkge1xuICAgICAgaWYgKC9cXGQrXFwuLy50ZXN0KGNoaWxkLmdldEJ1bGxldCgpKSkge1xuICAgICAgICBjaGlsZC5yZXBsYXRlQnVsbGV0KGAke2luZGV4Kyt9LmApO1xuICAgICAgfVxuXG4gICAgICB2aXNpdChjaGlsZCk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXQocm9vdCk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUG9zaXRpb24ge1xuICBjaDogbnVtYmVyO1xuICBsaW5lOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGlzdExpbmUge1xuICB0ZXh0OiBzdHJpbmc7XG4gIGZyb206IFBvc2l0aW9uO1xuICB0bzogUG9zaXRpb247XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmFuZ2Uge1xuICBhbmNob3I6IFBvc2l0aW9uO1xuICBoZWFkOiBQb3NpdGlvbjtcbn1cblxubGV0IGlkU2VxID0gMDtcblxuZXhwb3J0IGNsYXNzIExpc3Qge1xuICBwcml2YXRlIGlkOiBudW1iZXI7XG4gIHByaXZhdGUgcGFyZW50OiBMaXN0IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgY2hpbGRyZW46IExpc3RbXSA9IFtdO1xuICBwcml2YXRlIG5vdGVzSW5kZW50OiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBsaW5lczogc3RyaW5nW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJvb3Q6IFJvb3QsXG4gICAgcHJpdmF0ZSBpbmRlbnQ6IHN0cmluZyxcbiAgICBwcml2YXRlIGJ1bGxldDogc3RyaW5nLFxuICAgIHByaXZhdGUgb3B0aW9uYWxDaGVja2JveDogc3RyaW5nLFxuICAgIHByaXZhdGUgc3BhY2VBZnRlckJ1bGxldDogc3RyaW5nLFxuICAgIGZpcnN0TGluZTogc3RyaW5nLFxuICAgIHByaXZhdGUgZm9sZFJvb3Q6IGJvb2xlYW4sXG4gICkge1xuICAgIHRoaXMuaWQgPSBpZFNlcSsrO1xuICAgIHRoaXMubGluZXMucHVzaChmaXJzdExpbmUpO1xuICB9XG5cbiAgZ2V0SUQoKSB7XG4gICAgcmV0dXJuIHRoaXMuaWQ7XG4gIH1cblxuICBnZXROb3Rlc0luZGVudCgpOiBzdHJpbmcgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5ub3Rlc0luZGVudDtcbiAgfVxuXG4gIHNldE5vdGVzSW5kZW50KG5vdGVzSW5kZW50OiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5ub3Rlc0luZGVudCAhPT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBOb3RlcyBpbmRlbnQgYWxyZWFkeSBwcm92aWRlZGApO1xuICAgIH1cbiAgICB0aGlzLm5vdGVzSW5kZW50ID0gbm90ZXNJbmRlbnQ7XG4gIH1cblxuICBhZGRMaW5lKHRleHQ6IHN0cmluZykge1xuICAgIGlmICh0aGlzLm5vdGVzSW5kZW50ID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBVbmFibGUgdG8gYWRkIGxpbmUsIG5vdGVzIGluZGVudCBzaG91bGQgYmUgcHJvdmlkZWQgZmlyc3RgLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICB0aGlzLmxpbmVzLnB1c2godGV4dCk7XG4gIH1cblxuICByZXBsYWNlTGluZXMobGluZXM6IHN0cmluZ1tdKSB7XG4gICAgaWYgKGxpbmVzLmxlbmd0aCA+IDEgJiYgdGhpcy5ub3Rlc0luZGVudCA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgVW5hYmxlIHRvIGFkZCBsaW5lLCBub3RlcyBpbmRlbnQgc2hvdWxkIGJlIHByb3ZpZGVkIGZpcnN0YCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgdGhpcy5saW5lcyA9IGxpbmVzO1xuICB9XG5cbiAgZ2V0TGluZUNvdW50KCkge1xuICAgIHJldHVybiB0aGlzLmxpbmVzLmxlbmd0aDtcbiAgfVxuXG4gIGdldFJvb3QoKSB7XG4gICAgcmV0dXJuIHRoaXMucm9vdDtcbiAgfVxuXG4gIGdldENoaWxkcmVuKCkge1xuICAgIHJldHVybiB0aGlzLmNoaWxkcmVuLmNvbmNhdCgpO1xuICB9XG5cbiAgZ2V0TGluZXNJbmZvKCk6IExpc3RMaW5lW10ge1xuICAgIGNvbnN0IHN0YXJ0TGluZSA9IHRoaXMucm9vdC5nZXRDb250ZW50TGluZXNSYW5nZU9mKHRoaXMpWzBdO1xuXG4gICAgcmV0dXJuIHRoaXMubGluZXMubWFwKChyb3csIGkpID0+IHtcbiAgICAgIGNvbnN0IGxpbmUgPSBzdGFydExpbmUgKyBpO1xuICAgICAgY29uc3Qgc3RhcnRDaCA9XG4gICAgICAgIGkgPT09IDAgPyB0aGlzLmdldENvbnRlbnRTdGFydENoKCkgOiB0aGlzLm5vdGVzSW5kZW50Lmxlbmd0aDtcbiAgICAgIGNvbnN0IGVuZENoID0gc3RhcnRDaCArIHJvdy5sZW5ndGg7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRleHQ6IHJvdyxcbiAgICAgICAgZnJvbTogeyBsaW5lLCBjaDogc3RhcnRDaCB9LFxuICAgICAgICB0bzogeyBsaW5lLCBjaDogZW5kQ2ggfSxcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBnZXRMaW5lcygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIHRoaXMubGluZXMuY29uY2F0KCk7XG4gIH1cblxuICBnZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKSB7XG4gICAgY29uc3Qgc3RhcnRMaW5lID0gdGhpcy5yb290LmdldENvbnRlbnRMaW5lc1JhbmdlT2YodGhpcylbMF07XG5cbiAgICByZXR1cm4ge1xuICAgICAgbGluZTogc3RhcnRMaW5lLFxuICAgICAgY2g6IHRoaXMuZ2V0Q29udGVudFN0YXJ0Q2goKSxcbiAgICB9O1xuICB9XG5cbiAgZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0QWZ0ZXJDaGVja2JveCgpIHtcbiAgICBjb25zdCBzdGFydExpbmUgPSB0aGlzLnJvb3QuZ2V0Q29udGVudExpbmVzUmFuZ2VPZih0aGlzKVswXTtcblxuICAgIHJldHVybiB7XG4gICAgICBsaW5lOiBzdGFydExpbmUsXG4gICAgICBjaDogdGhpcy5nZXRDb250ZW50U3RhcnRDaCgpICsgdGhpcy5nZXRDaGVja2JveExlbmd0aCgpLFxuICAgIH07XG4gIH1cblxuICBnZXRMYXN0TGluZUNvbnRlbnRFbmQoKSB7XG4gICAgY29uc3QgZW5kTGluZSA9IHRoaXMucm9vdC5nZXRDb250ZW50TGluZXNSYW5nZU9mKHRoaXMpWzFdO1xuICAgIGNvbnN0IGVuZENoID1cbiAgICAgIHRoaXMubGluZXMubGVuZ3RoID09PSAxXG4gICAgICAgID8gdGhpcy5nZXRDb250ZW50U3RhcnRDaCgpICsgdGhpcy5saW5lc1swXS5sZW5ndGhcbiAgICAgICAgOiB0aGlzLm5vdGVzSW5kZW50Lmxlbmd0aCArIHRoaXMubGluZXNbdGhpcy5saW5lcy5sZW5ndGggLSAxXS5sZW5ndGg7XG5cbiAgICByZXR1cm4ge1xuICAgICAgbGluZTogZW5kTGluZSxcbiAgICAgIGNoOiBlbmRDaCxcbiAgICB9O1xuICB9XG5cbiAgZ2V0Q29udGVudEVuZEluY2x1ZGluZ0NoaWxkcmVuKCkge1xuICAgIHJldHVybiB0aGlzLmdldExhc3RDaGlsZCgpLmdldExhc3RMaW5lQ29udGVudEVuZCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRMYXN0Q2hpbGQoKSB7XG4gICAgbGV0IGxhc3RDaGlsZDogTGlzdCA9IHRoaXM7XG5cbiAgICB3aGlsZSAoIWxhc3RDaGlsZC5pc0VtcHR5KCkpIHtcbiAgICAgIGxhc3RDaGlsZCA9IGxhc3RDaGlsZC5nZXRDaGlsZHJlbigpLmxhc3QoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbGFzdENoaWxkO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRDb250ZW50U3RhcnRDaCgpIHtcbiAgICByZXR1cm4gdGhpcy5pbmRlbnQubGVuZ3RoICsgdGhpcy5idWxsZXQubGVuZ3RoICsgMTtcbiAgfVxuXG4gIGlzRm9sZGVkKCk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLmZvbGRSb290KSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5wYXJlbnQpIHtcbiAgICAgIHJldHVybiB0aGlzLnBhcmVudC5pc0ZvbGRlZCgpO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlzRm9sZFJvb3QoKSB7XG4gICAgcmV0dXJuIHRoaXMuZm9sZFJvb3Q7XG4gIH1cblxuICBnZXRUb3BGb2xkUm9vdCgpIHtcbiAgICBsZXQgdG1wOiBMaXN0ID0gdGhpcztcbiAgICBsZXQgZm9sZFJvb3Q6IExpc3QgfCBudWxsID0gbnVsbDtcbiAgICB3aGlsZSAodG1wKSB7XG4gICAgICBpZiAodG1wLmlzRm9sZFJvb3QoKSkge1xuICAgICAgICBmb2xkUm9vdCA9IHRtcDtcbiAgICAgIH1cbiAgICAgIHRtcCA9IHRtcC5wYXJlbnQ7XG4gICAgfVxuICAgIHJldHVybiBmb2xkUm9vdDtcbiAgfVxuXG4gIGdldExldmVsKCk6IG51bWJlciB7XG4gICAgaWYgKCF0aGlzLnBhcmVudCkge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMucGFyZW50LmdldExldmVsKCkgKyAxO1xuICB9XG5cbiAgdW5pbmRlbnRDb250ZW50KGZyb206IG51bWJlciwgdGlsbDogbnVtYmVyKSB7XG4gICAgdGhpcy5pbmRlbnQgPSB0aGlzLmluZGVudC5zbGljZSgwLCBmcm9tKSArIHRoaXMuaW5kZW50LnNsaWNlKHRpbGwpO1xuICAgIGlmICh0aGlzLm5vdGVzSW5kZW50ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGVzSW5kZW50ID1cbiAgICAgICAgdGhpcy5ub3Rlc0luZGVudC5zbGljZSgwLCBmcm9tKSArIHRoaXMubm90ZXNJbmRlbnQuc2xpY2UodGlsbCk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBjaGlsZCBvZiB0aGlzLmNoaWxkcmVuKSB7XG4gICAgICBjaGlsZC51bmluZGVudENvbnRlbnQoZnJvbSwgdGlsbCk7XG4gICAgfVxuICB9XG5cbiAgaW5kZW50Q29udGVudChpbmRlbnRQb3M6IG51bWJlciwgaW5kZW50Q2hhcnM6IHN0cmluZykge1xuICAgIHRoaXMuaW5kZW50ID1cbiAgICAgIHRoaXMuaW5kZW50LnNsaWNlKDAsIGluZGVudFBvcykgK1xuICAgICAgaW5kZW50Q2hhcnMgK1xuICAgICAgdGhpcy5pbmRlbnQuc2xpY2UoaW5kZW50UG9zKTtcbiAgICBpZiAodGhpcy5ub3Rlc0luZGVudCAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5ub3Rlc0luZGVudCA9XG4gICAgICAgIHRoaXMubm90ZXNJbmRlbnQuc2xpY2UoMCwgaW5kZW50UG9zKSArXG4gICAgICAgIGluZGVudENoYXJzICtcbiAgICAgICAgdGhpcy5ub3Rlc0luZGVudC5zbGljZShpbmRlbnRQb3MpO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgY2hpbGQgb2YgdGhpcy5jaGlsZHJlbikge1xuICAgICAgY2hpbGQuaW5kZW50Q29udGVudChpbmRlbnRQb3MsIGluZGVudENoYXJzKTtcbiAgICB9XG4gIH1cblxuICBnZXRGaXJzdExpbmVJbmRlbnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5kZW50O1xuICB9XG5cbiAgZ2V0QnVsbGV0KCkge1xuICAgIHJldHVybiB0aGlzLmJ1bGxldDtcbiAgfVxuXG4gIGdldFNwYWNlQWZ0ZXJCdWxsZXQoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3BhY2VBZnRlckJ1bGxldDtcbiAgfVxuXG4gIGdldENoZWNrYm94TGVuZ3RoKCkge1xuICAgIHJldHVybiB0aGlzLm9wdGlvbmFsQ2hlY2tib3gubGVuZ3RoO1xuICB9XG5cbiAgcmVwbGF0ZUJ1bGxldChidWxsZXQ6IHN0cmluZykge1xuICAgIHRoaXMuYnVsbGV0ID0gYnVsbGV0O1xuICB9XG5cbiAgZ2V0UGFyZW50KCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudDtcbiAgfVxuXG4gIGFkZEJlZm9yZUFsbChsaXN0OiBMaXN0KSB7XG4gICAgdGhpcy5jaGlsZHJlbi51bnNoaWZ0KGxpc3QpO1xuICAgIGxpc3QucGFyZW50ID0gdGhpcztcbiAgfVxuXG4gIGFkZEFmdGVyQWxsKGxpc3Q6IExpc3QpIHtcbiAgICB0aGlzLmNoaWxkcmVuLnB1c2gobGlzdCk7XG4gICAgbGlzdC5wYXJlbnQgPSB0aGlzO1xuICB9XG5cbiAgcmVtb3ZlQ2hpbGQobGlzdDogTGlzdCkge1xuICAgIGNvbnN0IGkgPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YobGlzdCk7XG4gICAgdGhpcy5jaGlsZHJlbi5zcGxpY2UoaSwgMSk7XG4gICAgbGlzdC5wYXJlbnQgPSBudWxsO1xuICB9XG5cbiAgYWRkQmVmb3JlKGJlZm9yZTogTGlzdCwgbGlzdDogTGlzdCkge1xuICAgIGNvbnN0IGkgPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YoYmVmb3JlKTtcbiAgICB0aGlzLmNoaWxkcmVuLnNwbGljZShpLCAwLCBsaXN0KTtcbiAgICBsaXN0LnBhcmVudCA9IHRoaXM7XG4gIH1cblxuICBhZGRBZnRlcihiZWZvcmU6IExpc3QsIGxpc3Q6IExpc3QpIHtcbiAgICBjb25zdCBpID0gdGhpcy5jaGlsZHJlbi5pbmRleE9mKGJlZm9yZSk7XG4gICAgdGhpcy5jaGlsZHJlbi5zcGxpY2UoaSArIDEsIDAsIGxpc3QpO1xuICAgIGxpc3QucGFyZW50ID0gdGhpcztcbiAgfVxuXG4gIGdldFByZXZTaWJsaW5nT2YobGlzdDogTGlzdCkge1xuICAgIGNvbnN0IGkgPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YobGlzdCk7XG4gICAgcmV0dXJuIGkgPiAwID8gdGhpcy5jaGlsZHJlbltpIC0gMV0gOiBudWxsO1xuICB9XG5cbiAgZ2V0TmV4dFNpYmxpbmdPZihsaXN0OiBMaXN0KSB7XG4gICAgY29uc3QgaSA9IHRoaXMuY2hpbGRyZW4uaW5kZXhPZihsaXN0KTtcbiAgICByZXR1cm4gaSA+PSAwICYmIGkgPCB0aGlzLmNoaWxkcmVuLmxlbmd0aCA/IHRoaXMuY2hpbGRyZW5baSArIDFdIDogbnVsbDtcbiAgfVxuXG4gIGlzRW1wdHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuY2hpbGRyZW4ubGVuZ3RoID09PSAwO1xuICB9XG5cbiAgcHJpbnQoKSB7XG4gICAgbGV0IHJlcyA9IFwiXCI7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlcyArPVxuICAgICAgICBpID09PSAwXG4gICAgICAgICAgPyB0aGlzLmluZGVudCArIHRoaXMuYnVsbGV0ICsgdGhpcy5zcGFjZUFmdGVyQnVsbGV0XG4gICAgICAgICAgOiB0aGlzLm5vdGVzSW5kZW50O1xuICAgICAgcmVzICs9IHRoaXMubGluZXNbaV07XG4gICAgICByZXMgKz0gXCJcXG5cIjtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIHRoaXMuY2hpbGRyZW4pIHtcbiAgICAgIHJlcyArPSBjaGlsZC5wcmludCgpO1xuICAgIH1cblxuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBjbG9uZShuZXdSb290OiBSb290KSB7XG4gICAgY29uc3QgY2xvbmUgPSBuZXcgTGlzdChcbiAgICAgIG5ld1Jvb3QsXG4gICAgICB0aGlzLmluZGVudCxcbiAgICAgIHRoaXMuYnVsbGV0LFxuICAgICAgdGhpcy5vcHRpb25hbENoZWNrYm94LFxuICAgICAgdGhpcy5zcGFjZUFmdGVyQnVsbGV0LFxuICAgICAgXCJcIixcbiAgICAgIHRoaXMuZm9sZFJvb3QsXG4gICAgKTtcbiAgICBjbG9uZS5pZCA9IHRoaXMuaWQ7XG4gICAgY2xvbmUubGluZXMgPSB0aGlzLmxpbmVzLmNvbmNhdCgpO1xuICAgIGNsb25lLm5vdGVzSW5kZW50ID0gdGhpcy5ub3Rlc0luZGVudDtcbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIHRoaXMuY2hpbGRyZW4pIHtcbiAgICAgIGNsb25lLmFkZEFmdGVyQWxsKGNoaWxkLmNsb25lKG5ld1Jvb3QpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY2xvbmU7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFJvb3Qge1xuICBwcml2YXRlIHJvb3RMaXN0ID0gbmV3IExpc3QodGhpcywgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgZmFsc2UpO1xuICBwcml2YXRlIHNlbGVjdGlvbnM6IFJhbmdlW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHN0YXJ0OiBQb3NpdGlvbixcbiAgICBwcml2YXRlIGVuZDogUG9zaXRpb24sXG4gICAgc2VsZWN0aW9uczogUmFuZ2VbXSxcbiAgKSB7XG4gICAgdGhpcy5yZXBsYWNlU2VsZWN0aW9ucyhzZWxlY3Rpb25zKTtcbiAgfVxuXG4gIGdldFJvb3RMaXN0KCkge1xuICAgIHJldHVybiB0aGlzLnJvb3RMaXN0O1xuICB9XG5cbiAgZ2V0Q29udGVudFJhbmdlKCk6IFtQb3NpdGlvbiwgUG9zaXRpb25dIHtcbiAgICByZXR1cm4gW3RoaXMuZ2V0Q29udGVudFN0YXJ0KCksIHRoaXMuZ2V0Q29udGVudEVuZCgpXTtcbiAgfVxuXG4gIGdldENvbnRlbnRTdGFydCgpOiBQb3NpdGlvbiB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5zdGFydCB9O1xuICB9XG5cbiAgZ2V0Q29udGVudEVuZCgpOiBQb3NpdGlvbiB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5lbmQgfTtcbiAgfVxuXG4gIGdldFNlbGVjdGlvbnMoKTogUmFuZ2VbXSB7XG4gICAgcmV0dXJuIHRoaXMuc2VsZWN0aW9ucy5tYXAoKHMpID0+ICh7XG4gICAgICBhbmNob3I6IHsgLi4ucy5hbmNob3IgfSxcbiAgICAgIGhlYWQ6IHsgLi4ucy5oZWFkIH0sXG4gICAgfSkpO1xuICB9XG5cbiAgaGFzU2luZ2xlQ3Vyc29yKCkge1xuICAgIGlmICghdGhpcy5oYXNTaW5nbGVTZWxlY3Rpb24oKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMuc2VsZWN0aW9uc1swXTtcblxuICAgIHJldHVybiAoXG4gICAgICBzZWxlY3Rpb24uYW5jaG9yLmxpbmUgPT09IHNlbGVjdGlvbi5oZWFkLmxpbmUgJiZcbiAgICAgIHNlbGVjdGlvbi5hbmNob3IuY2ggPT09IHNlbGVjdGlvbi5oZWFkLmNoXG4gICAgKTtcbiAgfVxuXG4gIGhhc1NpbmdsZVNlbGVjdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zZWxlY3Rpb25zLmxlbmd0aCA9PT0gMTtcbiAgfVxuXG4gIGdldFNlbGVjdGlvbigpIHtcbiAgICBjb25zdCBzZWxlY3Rpb24gPSB0aGlzLnNlbGVjdGlvbnNbdGhpcy5zZWxlY3Rpb25zLmxlbmd0aCAtIDFdO1xuXG4gICAgY29uc3QgZnJvbSA9XG4gICAgICBzZWxlY3Rpb24uYW5jaG9yLmNoID4gc2VsZWN0aW9uLmhlYWQuY2hcbiAgICAgICAgPyBzZWxlY3Rpb24uaGVhZC5jaFxuICAgICAgICA6IHNlbGVjdGlvbi5hbmNob3IuY2g7XG4gICAgY29uc3QgdG8gPVxuICAgICAgc2VsZWN0aW9uLmFuY2hvci5jaCA+IHNlbGVjdGlvbi5oZWFkLmNoXG4gICAgICAgID8gc2VsZWN0aW9uLmFuY2hvci5jaFxuICAgICAgICA6IHNlbGVjdGlvbi5oZWFkLmNoO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLnNlbGVjdGlvbixcbiAgICAgIGZyb20sXG4gICAgICB0byxcbiAgICB9O1xuICB9XG5cbiAgZ2V0Q3Vyc29yKCkge1xuICAgIHJldHVybiB7IC4uLnRoaXMuc2VsZWN0aW9uc1t0aGlzLnNlbGVjdGlvbnMubGVuZ3RoIC0gMV0uaGVhZCB9O1xuICB9XG5cbiAgcmVwbGFjZUN1cnNvcihjdXJzb3I6IFBvc2l0aW9uKSB7XG4gICAgdGhpcy5zZWxlY3Rpb25zID0gW3sgYW5jaG9yOiBjdXJzb3IsIGhlYWQ6IGN1cnNvciB9XTtcbiAgfVxuXG4gIHJlcGxhY2VTZWxlY3Rpb25zKHNlbGVjdGlvbnM6IFJhbmdlW10pIHtcbiAgICBpZiAoc2VsZWN0aW9ucy5sZW5ndGggPCAxKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBjcmVhdGUgUm9vdCB3aXRob3V0IHNlbGVjdGlvbnNgKTtcbiAgICB9XG4gICAgdGhpcy5zZWxlY3Rpb25zID0gc2VsZWN0aW9ucztcbiAgfVxuXG4gIGdldExpc3RVbmRlckN1cnNvcigpOiBMaXN0IHtcbiAgICByZXR1cm4gdGhpcy5nZXRMaXN0VW5kZXJMaW5lKHRoaXMuZ2V0Q3Vyc29yKCkubGluZSk7XG4gIH1cblxuICBnZXRMaXN0VW5kZXJMaW5lKGxpbmU6IG51bWJlcikge1xuICAgIGlmIChsaW5lIDwgdGhpcy5zdGFydC5saW5lIHx8IGxpbmUgPiB0aGlzLmVuZC5saW5lKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IHJlc3VsdDogTGlzdCA9IG51bGw7XG4gICAgbGV0IGluZGV4OiBudW1iZXIgPSB0aGlzLnN0YXJ0LmxpbmU7XG5cbiAgICBjb25zdCB2aXNpdEFyciA9IChsbDogTGlzdFtdKSA9PiB7XG4gICAgICBmb3IgKGNvbnN0IGwgb2YgbGwpIHtcbiAgICAgICAgY29uc3QgbGlzdEZyb21MaW5lID0gaW5kZXg7XG4gICAgICAgIGNvbnN0IGxpc3RUaWxsTGluZSA9IGxpc3RGcm9tTGluZSArIGwuZ2V0TGluZUNvdW50KCkgLSAxO1xuXG4gICAgICAgIGlmIChsaW5lID49IGxpc3RGcm9tTGluZSAmJiBsaW5lIDw9IGxpc3RUaWxsTGluZSkge1xuICAgICAgICAgIHJlc3VsdCA9IGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaW5kZXggPSBsaXN0VGlsbExpbmUgKyAxO1xuICAgICAgICAgIHZpc2l0QXJyKGwuZ2V0Q2hpbGRyZW4oKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc3VsdCAhPT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICB2aXNpdEFycih0aGlzLnJvb3RMaXN0LmdldENoaWxkcmVuKCkpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGdldENvbnRlbnRMaW5lc1JhbmdlT2YobGlzdDogTGlzdCk6IFtudW1iZXIsIG51bWJlcl0gfCBudWxsIHtcbiAgICBsZXQgcmVzdWx0OiBbbnVtYmVyLCBudW1iZXJdIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IGxpbmU6IG51bWJlciA9IHRoaXMuc3RhcnQubGluZTtcblxuICAgIGNvbnN0IHZpc2l0QXJyID0gKGxsOiBMaXN0W10pID0+IHtcbiAgICAgIGZvciAoY29uc3QgbCBvZiBsbCkge1xuICAgICAgICBjb25zdCBsaXN0RnJvbUxpbmUgPSBsaW5lO1xuICAgICAgICBjb25zdCBsaXN0VGlsbExpbmUgPSBsaXN0RnJvbUxpbmUgKyBsLmdldExpbmVDb3VudCgpIC0gMTtcblxuICAgICAgICBpZiAobCA9PT0gbGlzdCkge1xuICAgICAgICAgIHJlc3VsdCA9IFtsaXN0RnJvbUxpbmUsIGxpc3RUaWxsTGluZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGluZSA9IGxpc3RUaWxsTGluZSArIDE7XG4gICAgICAgICAgdmlzaXRBcnIobC5nZXRDaGlsZHJlbigpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQgIT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgdmlzaXRBcnIodGhpcy5yb290TGlzdC5nZXRDaGlsZHJlbigpKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBnZXRDaGlsZHJlbigpIHtcbiAgICByZXR1cm4gdGhpcy5yb290TGlzdC5nZXRDaGlsZHJlbigpO1xuICB9XG5cbiAgcHJpbnQoKSB7XG4gICAgbGV0IHJlcyA9IFwiXCI7XG5cbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIHRoaXMucm9vdExpc3QuZ2V0Q2hpbGRyZW4oKSkge1xuICAgICAgcmVzICs9IGNoaWxkLnByaW50KCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcy5yZXBsYWNlKC9cXG4kLywgXCJcIik7XG4gIH1cblxuICBjbG9uZSgpIHtcbiAgICBjb25zdCBjbG9uZSA9IG5ldyBSb290KFxuICAgICAgeyAuLi50aGlzLnN0YXJ0IH0sXG4gICAgICB7IC4uLnRoaXMuZW5kIH0sXG4gICAgICB0aGlzLmdldFNlbGVjdGlvbnMoKSxcbiAgICApO1xuICAgIGNsb25lLnJvb3RMaXN0ID0gdGhpcy5yb290TGlzdC5jbG9uZShjbG9uZSk7XG4gICAgcmV0dXJuIGNsb25lO1xuICB9XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHtcbiAgTGlzdCxcbiAgTGlzdExpbmUsXG4gIFBvc2l0aW9uLFxuICBSb290LFxuICByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzLFxufSBmcm9tIFwiLi4vcm9vdFwiO1xuXG5leHBvcnQgY2xhc3MgRGVsZXRlVGlsbFByZXZpb3VzTGluZUNvbnRlbnRFbmQgaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlO1xuICBwcml2YXRlIHVwZGF0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJDdXJzb3IoKTtcbiAgICBjb25zdCBjdXJzb3IgPSByb290LmdldEN1cnNvcigpO1xuICAgIGNvbnN0IGxpbmVzID0gbGlzdC5nZXRMaW5lc0luZm8oKTtcblxuICAgIGNvbnN0IGxpbmVObyA9IGxpbmVzLmZpbmRJbmRleChcbiAgICAgIChsKSA9PiBjdXJzb3IuY2ggPT09IGwuZnJvbS5jaCAmJiBjdXJzb3IubGluZSA9PT0gbC5mcm9tLmxpbmUsXG4gICAgKTtcblxuICAgIGlmIChsaW5lTm8gPT09IDApIHtcbiAgICAgIHRoaXMubWVyZ2VXaXRoUHJldmlvdXNJdGVtKHJvb3QsIGN1cnNvciwgbGlzdCk7XG4gICAgfSBlbHNlIGlmIChsaW5lTm8gPiAwKSB7XG4gICAgICB0aGlzLm1lcmdlTm90ZXMocm9vdCwgY3Vyc29yLCBsaXN0LCBsaW5lcywgbGluZU5vKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIG1lcmdlTm90ZXMoXG4gICAgcm9vdDogUm9vdCxcbiAgICBjdXJzb3I6IFBvc2l0aW9uLFxuICAgIGxpc3Q6IExpc3QsXG4gICAgbGluZXM6IExpc3RMaW5lW10sXG4gICAgbGluZU5vOiBudW1iZXIsXG4gICkge1xuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcbiAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgY29uc3QgcHJldkxpbmVObyA9IGxpbmVObyAtIDE7XG5cbiAgICByb290LnJlcGxhY2VDdXJzb3Ioe1xuICAgICAgbGluZTogY3Vyc29yLmxpbmUgLSAxLFxuICAgICAgY2g6IGxpbmVzW3ByZXZMaW5lTm9dLnRleHQubGVuZ3RoICsgbGluZXNbcHJldkxpbmVOb10uZnJvbS5jaCxcbiAgICB9KTtcblxuICAgIGxpbmVzW3ByZXZMaW5lTm9dLnRleHQgKz0gbGluZXNbbGluZU5vXS50ZXh0O1xuICAgIGxpbmVzLnNwbGljZShsaW5lTm8sIDEpO1xuXG4gICAgbGlzdC5yZXBsYWNlTGluZXMobGluZXMubWFwKChsKSA9PiBsLnRleHQpKTtcbiAgfVxuXG4gIHByaXZhdGUgbWVyZ2VXaXRoUHJldmlvdXNJdGVtKHJvb3Q6IFJvb3QsIGN1cnNvcjogUG9zaXRpb24sIGxpc3Q6IExpc3QpIHtcbiAgICBpZiAocm9vdC5nZXRDaGlsZHJlbigpWzBdID09PSBsaXN0ICYmIGxpc3QuaXNFbXB0eSgpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuXG4gICAgY29uc3QgcHJldiA9IHJvb3QuZ2V0TGlzdFVuZGVyTGluZShjdXJzb3IubGluZSAtIDEpO1xuXG4gICAgaWYgKCFwcmV2KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYm90aEFyZUVtcHR5ID0gcHJldi5pc0VtcHR5KCkgJiYgbGlzdC5pc0VtcHR5KCk7XG4gICAgY29uc3QgcHJldklzRW1wdHlBbmRTYW1lTGV2ZWwgPVxuICAgICAgcHJldi5pc0VtcHR5KCkgJiYgIWxpc3QuaXNFbXB0eSgpICYmIHByZXYuZ2V0TGV2ZWwoKSA9PT0gbGlzdC5nZXRMZXZlbCgpO1xuICAgIGNvbnN0IGxpc3RJc0VtcHR5QW5kUHJldklzUGFyZW50ID1cbiAgICAgIGxpc3QuaXNFbXB0eSgpICYmIHByZXYuZ2V0TGV2ZWwoKSA9PT0gbGlzdC5nZXRMZXZlbCgpIC0gMTtcblxuICAgIGlmIChib3RoQXJlRW1wdHkgfHwgcHJldklzRW1wdHlBbmRTYW1lTGV2ZWwgfHwgbGlzdElzRW1wdHlBbmRQcmV2SXNQYXJlbnQpIHtcbiAgICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG5cbiAgICAgIGNvbnN0IHBhcmVudCA9IGxpc3QuZ2V0UGFyZW50KCk7XG4gICAgICBjb25zdCBwcmV2RW5kID0gcHJldi5nZXRMYXN0TGluZUNvbnRlbnRFbmQoKTtcblxuICAgICAgaWYgKCFwcmV2LmdldE5vdGVzSW5kZW50KCkgJiYgbGlzdC5nZXROb3Rlc0luZGVudCgpKSB7XG4gICAgICAgIHByZXYuc2V0Tm90ZXNJbmRlbnQoXG4gICAgICAgICAgcHJldi5nZXRGaXJzdExpbmVJbmRlbnQoKSArXG4gICAgICAgICAgICBsaXN0LmdldE5vdGVzSW5kZW50KCkuc2xpY2UobGlzdC5nZXRGaXJzdExpbmVJbmRlbnQoKS5sZW5ndGgpLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBvbGRMaW5lcyA9IHByZXYuZ2V0TGluZXMoKTtcbiAgICAgIGNvbnN0IG5ld0xpbmVzID0gbGlzdC5nZXRMaW5lcygpO1xuICAgICAgb2xkTGluZXNbb2xkTGluZXMubGVuZ3RoIC0gMV0gKz0gbmV3TGluZXNbMF07XG4gICAgICBjb25zdCByZXN1bHRMaW5lcyA9IG9sZExpbmVzLmNvbmNhdChuZXdMaW5lcy5zbGljZSgxKSk7XG5cbiAgICAgIHByZXYucmVwbGFjZUxpbmVzKHJlc3VsdExpbmVzKTtcbiAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChsaXN0KTtcblxuICAgICAgZm9yIChjb25zdCBjIG9mIGxpc3QuZ2V0Q2hpbGRyZW4oKSkge1xuICAgICAgICBsaXN0LnJlbW92ZUNoaWxkKGMpO1xuICAgICAgICBwcmV2LmFkZEFmdGVyQWxsKGMpO1xuICAgICAgfVxuXG4gICAgICByb290LnJlcGxhY2VDdXJzb3IocHJldkVuZCk7XG5cbiAgICAgIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMocm9vdCk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsga2V5bWFwIH0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBEZWxldGVUaWxsUHJldmlvdXNMaW5lQ29udGVudEVuZCB9IGZyb20gXCIuLi9vcGVyYXRpb25zL0RlbGV0ZVRpbGxQcmV2aW91c0xpbmVDb250ZW50RW5kXCI7XG5pbXBvcnQgeyBJTUVEZXRlY3RvciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9JTUVEZXRlY3RvclwiO1xuaW1wb3J0IHsgT3BlcmF0aW9uUGVyZm9ybWVyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09wZXJhdGlvblBlcmZvcm1lclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcbmltcG9ydCB7IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrIH0gZnJvbSBcIi4uL3V0aWxzL2NyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrXCI7XG5cbmV4cG9ydCBjbGFzcyBCYWNrc3BhY2VCZWhhdmlvdXJPdmVycmlkZSBpbXBsZW1lbnRzIEZlYXR1cmUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICAgIHByaXZhdGUgaW1lRGV0ZWN0b3I6IElNRURldGVjdG9yLFxuICAgIHByaXZhdGUgb3BlcmF0aW9uUGVyZm9ybWVyOiBPcGVyYXRpb25QZXJmb3JtZXIsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMucGx1Z2luLnJlZ2lzdGVyRWRpdG9yRXh0ZW5zaW9uKFxuICAgICAga2V5bWFwLm9mKFtcbiAgICAgICAge1xuICAgICAgICAgIGtleTogXCJCYWNrc3BhY2VcIixcbiAgICAgICAgICBydW46IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKHtcbiAgICAgICAgICAgIGNoZWNrOiB0aGlzLmNoZWNrLFxuICAgICAgICAgICAgcnVuOiB0aGlzLnJ1bixcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIF0pLFxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgY2hlY2sgPSAoKSA9PiB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuc2V0dGluZ3Mua2VlcEN1cnNvcldpdGhpbkNvbnRlbnQgIT09IFwibmV2ZXJcIiAmJlxuICAgICAgIXRoaXMuaW1lRGV0ZWN0b3IuaXNPcGVuZWQoKVxuICAgICk7XG4gIH07XG5cbiAgcHJpdmF0ZSBydW4gPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIHJldHVybiB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5wZXJmb3JtKFxuICAgICAgKHJvb3QpID0+IG5ldyBEZWxldGVUaWxsUHJldmlvdXNMaW5lQ29udGVudEVuZChyb290KSxcbiAgICAgIGVkaXRvcixcbiAgICApO1xuICB9O1xufVxuIiwiaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgT2JzaWRpYW5TZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PYnNpZGlhblNldHRpbmdzXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9TZXR0aW5nc1wiO1xuXG5jb25zdCBCRVRURVJfTElTVFNfQk9EWV9DTEFTUyA9IFwib3V0bGluZXItcGx1Z2luLWJldHRlci1saXN0c1wiO1xuXG5leHBvcnQgY2xhc3MgQmV0dGVyTGlzdHNTdHlsZXMgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgcHJpdmF0ZSB1cGRhdGVCb2R5Q2xhc3NJbnRlcnZhbDogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICAgIHByaXZhdGUgb2JzaWRpYW5TZXR0aW5nczogT2JzaWRpYW5TZXR0aW5ncyxcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy51cGRhdGVCb2R5Q2xhc3MoKTtcbiAgICB0aGlzLnVwZGF0ZUJvZHlDbGFzc0ludGVydmFsID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgIHRoaXMudXBkYXRlQm9keUNsYXNzKCk7XG4gICAgfSwgMTAwMCk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7XG4gICAgY2xlYXJJbnRlcnZhbCh0aGlzLnVwZGF0ZUJvZHlDbGFzc0ludGVydmFsKTtcbiAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoQkVUVEVSX0xJU1RTX0JPRFlfQ0xBU1MpO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVCb2R5Q2xhc3MgPSAoKSA9PiB7XG4gICAgY29uc3Qgc2hvdWxkRXhpc3RzID1cbiAgICAgIHRoaXMub2JzaWRpYW5TZXR0aW5ncy5pc0RlZmF1bHRUaGVtZUVuYWJsZWQoKSAmJlxuICAgICAgdGhpcy5zZXR0aW5ncy5iZXR0ZXJMaXN0c1N0eWxlcztcbiAgICBjb25zdCBleGlzdHMgPSBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5jb250YWlucyhCRVRURVJfTElTVFNfQk9EWV9DTEFTUyk7XG5cbiAgICBpZiAoc2hvdWxkRXhpc3RzICYmICFleGlzdHMpIHtcbiAgICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZChCRVRURVJfTElTVFNfQk9EWV9DTEFTUyk7XG4gICAgfVxuXG4gICAgaWYgKCFzaG91bGRFeGlzdHMgJiYgZXhpc3RzKSB7XG4gICAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoQkVUVEVSX0xJU1RTX0JPRFlfQ0xBU1MpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBQb3NpdGlvbiwgUm9vdCwgY21wUG9zLCBtYXhQb3MsIG1pblBvcyB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBTZWxlY3RBbGxDb250ZW50IGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByb290OiBSb290KSB7fVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdG9wUHJvcGFnYXRpb247XG4gIH1cblxuICBzaG91bGRVcGRhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlZDtcbiAgfVxuXG4gIHBlcmZvcm0oKTogYm9vbGVhbiB7XG4gICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgICB0aGlzLnVwZGF0ZWQgPSBmYWxzZTtcblxuICAgIGNvbnN0IHsgcm9vdCB9ID0gdGhpcztcbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlU2VsZWN0aW9uKCkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGFuY2hvciwgaGVhZCB9ID0gcm9vdC5nZXRTZWxlY3Rpb24oKTtcbiAgICBjb25zdCBmcm9tID0gbWluUG9zKGFuY2hvciwgaGVhZCk7XG4gICAgY29uc3QgdG8gPSBtYXhQb3MoYW5jaG9yLCBoZWFkKTtcbiAgICBjb25zdCBbcm9vdFN0YXJ0LCByb290RW5kXSA9IHJvb3QuZ2V0Q29udGVudFJhbmdlKCk7XG5cbiAgICBpZiAoY21wUG9zKGZyb20sIHJvb3RTdGFydCkgPCAwIHx8IGNtcFBvcyh0bywgcm9vdEVuZCkgPiAwKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgbGV0IGxpc3QgPSByb290LmdldExpc3RVbmRlckxpbmUoZnJvbS5saW5lKTtcbiAgICBpZiAoIWxpc3QpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCByYW5nZXM6IFtQb3NpdGlvbiwgUG9zaXRpb25dW10gPSBbXG4gICAgICBbXG4gICAgICAgIGxpc3QuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0QWZ0ZXJDaGVja2JveCgpLFxuICAgICAgICBsaXN0LmdldExhc3RMaW5lQ29udGVudEVuZCgpLFxuICAgICAgXSxcbiAgICBdO1xuXG4gICAgLy8gQW5jZXN0b3JzIGFsc28gY292ZXIgc2VsZWN0aW9ucyBzcGFubmluZyBzZXZlcmFsIGl0ZW1zLiBUaGUgc3ludGhldGljXG4gICAgLy8gcm9vdCBoYXMgbm8gTGlzdCBjb29yZGluYXRlczsgaXRzIHJhbmdlIGNvbWVzIGZyb20gUm9vdCBpbnN0ZWFkLlxuICAgIHdoaWxlIChsaXN0ICYmIGxpc3QgIT09IHJvb3QuZ2V0Um9vdExpc3QoKSkge1xuICAgICAgcmFuZ2VzLnB1c2goW1xuICAgICAgICBsaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydEFmdGVyQ2hlY2tib3goKSxcbiAgICAgICAgbGlzdC5nZXRDb250ZW50RW5kSW5jbHVkaW5nQ2hpbGRyZW4oKSxcbiAgICAgIF0pO1xuICAgICAgbGlzdCA9IGxpc3QuZ2V0UGFyZW50KCk7XG4gICAgfVxuICAgIHJhbmdlcy5wdXNoKFtyb290U3RhcnQsIHJvb3RFbmRdKTtcblxuICAgIC8vIFNraXAgZXF1YWwgb3Igbm9uLWNvbnRhaW5pbmcgcmFuZ2VzLCBpbmNsdWRpbmcgdGhvc2UgdGhhdCB3b3VsZCBkaXNjYXJkXG4gICAgLy8gYW4gYWxyZWFkeSBzZWxlY3RlZCBidWxsZXQsIGluZGVudGF0aW9uIG9yIGNoZWNrYm94LlxuICAgIGNvbnN0IG5leHRSYW5nZSA9IHJhbmdlcy5maW5kKFxuICAgICAgKFtzdGFydCwgZW5kXSkgPT5cbiAgICAgICAgY21wUG9zKHN0YXJ0LCBmcm9tKSA8PSAwICYmXG4gICAgICAgIGNtcFBvcyh0bywgZW5kKSA8PSAwICYmXG4gICAgICAgIChjbXBQb3Moc3RhcnQsIGZyb20pIDwgMCB8fCBjbXBQb3ModG8sIGVuZCkgPCAwKSxcbiAgICApO1xuICAgIGlmICghbmV4dFJhbmdlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcm9vdC5yZXBsYWNlU2VsZWN0aW9ucyhbeyBhbmNob3I6IG5leHRSYW5nZVswXSwgaGVhZDogbmV4dFJhbmdlWzFdIH1dKTtcbiAgICB0aGlzLnN0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG4gICAgdGhpcy51cGRhdGVkID0gdHJ1ZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IGtleW1hcCB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgU2VsZWN0QWxsQ29udGVudCB9IGZyb20gXCIuLi9vcGVyYXRpb25zL1NlbGVjdEFsbENvbnRlbnRcIjtcbmltcG9ydCB7IElNRURldGVjdG9yIH0gZnJvbSBcIi4uL3NlcnZpY2VzL0lNRURldGVjdG9yXCI7XG5pbXBvcnQgeyBPcGVyYXRpb25QZXJmb3JtZXIgfSBmcm9tIFwiLi4vc2VydmljZXMvT3BlcmF0aW9uUGVyZm9ybWVyXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9TZXR0aW5nc1wiO1xuaW1wb3J0IHsgY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2sgfSBmcm9tIFwiLi4vdXRpbHMvY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2tcIjtcblxuZXhwb3J0IGNsYXNzIEN0cmxBQW5kQ21kQUJlaGF2aW91ck92ZXJyaWRlIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBpbWVEZXRlY3RvcjogSU1FRGV0ZWN0b3IsXG4gICAgcHJpdmF0ZSBvcGVyYXRpb25QZXJmb3JtZXI6IE9wZXJhdGlvblBlcmZvcm1lcixcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFZGl0b3JFeHRlbnNpb24oXG4gICAgICBrZXltYXAub2YoW1xuICAgICAgICB7XG4gICAgICAgICAga2V5OiBcImMtYVwiLFxuICAgICAgICAgIG1hYzogXCJtLWFcIixcbiAgICAgICAgICBydW46IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKHtcbiAgICAgICAgICAgIGNoZWNrOiB0aGlzLmNoZWNrLFxuICAgICAgICAgICAgcnVuOiB0aGlzLnJ1bixcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIF0pLFxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgY2hlY2sgPSAoKSA9PiB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuc2V0dGluZ3Mub3ZlcnJpZGVTZWxlY3RBbGxCZWhhdmlvdXIgJiYgIXRoaXMuaW1lRGV0ZWN0b3IuaXNPcGVuZWQoKVxuICAgICk7XG4gIH07XG5cbiAgcHJpdmF0ZSBydW4gPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIHJldHVybiB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5wZXJmb3JtKFxuICAgICAgKHJvb3QpID0+IG5ldyBTZWxlY3RBbGxDb250ZW50KHJvb3QpLFxuICAgICAgZWRpdG9yLFxuICAgICk7XG4gIH07XG59XG4iLCJpbXBvcnQgeyBEZWxldGVUaWxsUHJldmlvdXNMaW5lQ29udGVudEVuZCB9IGZyb20gXCIuL0RlbGV0ZVRpbGxQcmV2aW91c0xpbmVDb250ZW50RW5kXCI7XG5pbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgUm9vdCB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBEZWxldGVUaWxsTmV4dExpbmVDb250ZW50U3RhcnQgaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIGRlbGV0ZVRpbGxQcmV2aW91c0xpbmVDb250ZW50RW5kOiBEZWxldGVUaWxsUHJldmlvdXNMaW5lQ29udGVudEVuZDtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHtcbiAgICB0aGlzLmRlbGV0ZVRpbGxQcmV2aW91c0xpbmVDb250ZW50RW5kID1cbiAgICAgIG5ldyBEZWxldGVUaWxsUHJldmlvdXNMaW5lQ29udGVudEVuZChyb290KTtcbiAgfVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5kZWxldGVUaWxsUHJldmlvdXNMaW5lQ29udGVudEVuZC5zaG91bGRTdG9wUHJvcGFnYXRpb24oKTtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5kZWxldGVUaWxsUHJldmlvdXNMaW5lQ29udGVudEVuZC5zaG91bGRVcGRhdGUoKTtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgeyByb290IH0gPSB0aGlzO1xuXG4gICAgaWYgKCFyb290Lmhhc1NpbmdsZUN1cnNvcigpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcbiAgICBjb25zdCBsaW5lcyA9IGxpc3QuZ2V0TGluZXNJbmZvKCk7XG5cbiAgICBjb25zdCBsaW5lTm8gPSBsaW5lcy5maW5kSW5kZXgoXG4gICAgICAobCkgPT4gY3Vyc29yLmNoID09PSBsLnRvLmNoICYmIGN1cnNvci5saW5lID09PSBsLnRvLmxpbmUsXG4gICAgKTtcblxuICAgIGlmIChsaW5lTm8gPT09IGxpbmVzLmxlbmd0aCAtIDEpIHtcbiAgICAgIGNvbnN0IG5leHRMaW5lID0gbGluZXNbbGluZU5vXS50by5saW5lICsgMTtcbiAgICAgIGNvbnN0IG5leHRMaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJMaW5lKG5leHRMaW5lKTtcbiAgICAgIGlmICghbmV4dExpc3QpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgcm9vdC5yZXBsYWNlQ3Vyc29yKG5leHRMaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpKTtcbiAgICAgIHRoaXMuZGVsZXRlVGlsbFByZXZpb3VzTGluZUNvbnRlbnRFbmQucGVyZm9ybSgpO1xuICAgIH0gZWxzZSBpZiAobGluZU5vID49IDApIHtcbiAgICAgIHJvb3QucmVwbGFjZUN1cnNvcihsaW5lc1tsaW5lTm8gKyAxXS5mcm9tKTtcbiAgICAgIHRoaXMuZGVsZXRlVGlsbFByZXZpb3VzTGluZUNvbnRlbnRFbmQucGVyZm9ybSgpO1xuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IGtleW1hcCB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgRGVsZXRlVGlsbE5leHRMaW5lQ29udGVudFN0YXJ0IH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvRGVsZXRlVGlsbE5leHRMaW5lQ29udGVudFN0YXJ0XCI7XG5pbXBvcnQgeyBJTUVEZXRlY3RvciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9JTUVEZXRlY3RvclwiO1xuaW1wb3J0IHsgT3BlcmF0aW9uUGVyZm9ybWVyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09wZXJhdGlvblBlcmZvcm1lclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcbmltcG9ydCB7IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrIH0gZnJvbSBcIi4uL3V0aWxzL2NyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrXCI7XG5cbmV4cG9ydCBjbGFzcyBEZWxldGVCZWhhdmlvdXJPdmVycmlkZSBpbXBsZW1lbnRzIEZlYXR1cmUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICAgIHByaXZhdGUgaW1lRGV0ZWN0b3I6IElNRURldGVjdG9yLFxuICAgIHByaXZhdGUgb3BlcmF0aW9uUGVyZm9ybWVyOiBPcGVyYXRpb25QZXJmb3JtZXIsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMucGx1Z2luLnJlZ2lzdGVyRWRpdG9yRXh0ZW5zaW9uKFxuICAgICAga2V5bWFwLm9mKFtcbiAgICAgICAge1xuICAgICAgICAgIGtleTogXCJEZWxldGVcIixcbiAgICAgICAgICBydW46IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKHtcbiAgICAgICAgICAgIGNoZWNrOiB0aGlzLmNoZWNrLFxuICAgICAgICAgICAgcnVuOiB0aGlzLnJ1bixcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIF0pLFxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgY2hlY2sgPSAoKSA9PiB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuc2V0dGluZ3Mua2VlcEN1cnNvcldpdGhpbkNvbnRlbnQgIT09IFwibmV2ZXJcIiAmJlxuICAgICAgIXRoaXMuaW1lRGV0ZWN0b3IuaXNPcGVuZWQoKVxuICAgICk7XG4gIH07XG5cbiAgcHJpdmF0ZSBydW4gPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIHJldHVybiB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5wZXJmb3JtKFxuICAgICAgKHJvb3QpID0+IG5ldyBEZWxldGVUaWxsTmV4dExpbmVDb250ZW50U3RhcnQocm9vdCksXG4gICAgICBlZGl0b3IsXG4gICAgKTtcbiAgfTtcbn1cbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBMaXN0LCBSb290LCByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzIH0gZnJvbSBcIi4uL3Jvb3RcIjtcblxuaW50ZXJmYWNlIEN1cnNvckFuY2hvciB7XG4gIGN1cnNvckxpc3Q6IExpc3Q7XG4gIGxpbmVEaWZmOiBudW1iZXI7XG4gIGNoRGlmZjogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgTW92ZUxpc3RUb0RpZmZlcmVudFBvc2l0aW9uIGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByb290OiBSb290LFxuICAgIHByaXZhdGUgbGlzdFRvTW92ZTogTGlzdCxcbiAgICBwcml2YXRlIHBsYWNlVG9Nb3ZlOiBMaXN0LFxuICAgIHByaXZhdGUgd2hlcmVUb01vdmU6IFwiYmVmb3JlXCIgfCBcImFmdGVyXCIgfCBcImluc2lkZVwiLFxuICAgIHByaXZhdGUgZGVmYXVsdEluZGVudENoYXJzOiBzdHJpbmcsXG4gICkge31cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcFByb3BhZ2F0aW9uO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlKCkge1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZWQ7XG4gIH1cblxuICBwZXJmb3JtKCkge1xuICAgIGlmICh0aGlzLmxpc3RUb01vdmUgPT09IHRoaXMucGxhY2VUb01vdmUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnN0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG4gICAgdGhpcy51cGRhdGVkID0gdHJ1ZTtcblxuICAgIGNvbnN0IGN1cnNvckFuY2hvciA9IHRoaXMuY2FsY3VsYXRlQ3Vyc29yQW5jaG9yKCk7XG4gICAgdGhpcy5tb3ZlTGlzdCgpO1xuICAgIHRoaXMuY2hhbmdlSW5kZW50KCk7XG4gICAgdGhpcy5yZXN0b3JlQ3Vyc29yKGN1cnNvckFuY2hvcik7XG4gICAgcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyh0aGlzLnJvb3QpO1xuICB9XG5cbiAgcHJpdmF0ZSBjYWxjdWxhdGVDdXJzb3JBbmNob3IoKTogQ3Vyc29yQW5jaG9yIHtcbiAgICBjb25zdCBjdXJzb3JMaW5lID0gdGhpcy5yb290LmdldEN1cnNvcigpLmxpbmU7XG5cbiAgICBjb25zdCBsaW5lcyA9IFtcbiAgICAgIHRoaXMubGlzdFRvTW92ZS5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKS5saW5lLFxuICAgICAgdGhpcy5saXN0VG9Nb3ZlLmdldExhc3RMaW5lQ29udGVudEVuZCgpLmxpbmUsXG4gICAgICB0aGlzLnBsYWNlVG9Nb3ZlLmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUsXG4gICAgICB0aGlzLnBsYWNlVG9Nb3ZlLmdldExhc3RMaW5lQ29udGVudEVuZCgpLmxpbmUsXG4gICAgXTtcbiAgICBjb25zdCBsaXN0U3RhcnRMaW5lID0gTWF0aC5taW4oLi4ubGluZXMpO1xuICAgIGNvbnN0IGxpc3RFbmRMaW5lID0gTWF0aC5tYXgoLi4ubGluZXMpO1xuXG4gICAgaWYgKGN1cnNvckxpbmUgPCBsaXN0U3RhcnRMaW5lIHx8IGN1cnNvckxpbmUgPiBsaXN0RW5kTGluZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgY3Vyc29yID0gdGhpcy5yb290LmdldEN1cnNvcigpO1xuICAgIGNvbnN0IGN1cnNvckxpc3QgPSB0aGlzLnJvb3QuZ2V0TGlzdFVuZGVyTGluZShjdXJzb3IubGluZSk7XG4gICAgY29uc3QgY3Vyc29yTGlzdFN0YXJ0ID0gY3Vyc29yTGlzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKTtcbiAgICBjb25zdCBsaW5lRGlmZiA9IGN1cnNvci5saW5lIC0gY3Vyc29yTGlzdFN0YXJ0LmxpbmU7XG4gICAgY29uc3QgY2hEaWZmID0gY3Vyc29yLmNoIC0gY3Vyc29yTGlzdFN0YXJ0LmNoO1xuXG4gICAgcmV0dXJuIHsgY3Vyc29yTGlzdCwgbGluZURpZmYsIGNoRGlmZiB9O1xuICB9XG5cbiAgcHJpdmF0ZSBtb3ZlTGlzdCgpIHtcbiAgICB0aGlzLmxpc3RUb01vdmUuZ2V0UGFyZW50KCkucmVtb3ZlQ2hpbGQodGhpcy5saXN0VG9Nb3ZlKTtcblxuICAgIHN3aXRjaCAodGhpcy53aGVyZVRvTW92ZSkge1xuICAgICAgY2FzZSBcImJlZm9yZVwiOlxuICAgICAgICB0aGlzLnBsYWNlVG9Nb3ZlXG4gICAgICAgICAgLmdldFBhcmVudCgpXG4gICAgICAgICAgLmFkZEJlZm9yZSh0aGlzLnBsYWNlVG9Nb3ZlLCB0aGlzLmxpc3RUb01vdmUpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBcImFmdGVyXCI6XG4gICAgICAgIHRoaXMucGxhY2VUb01vdmVcbiAgICAgICAgICAuZ2V0UGFyZW50KClcbiAgICAgICAgICAuYWRkQWZ0ZXIodGhpcy5wbGFjZVRvTW92ZSwgdGhpcy5saXN0VG9Nb3ZlKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgXCJpbnNpZGVcIjpcbiAgICAgICAgdGhpcy5wbGFjZVRvTW92ZS5hZGRCZWZvcmVBbGwodGhpcy5saXN0VG9Nb3ZlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBjaGFuZ2VJbmRlbnQoKSB7XG4gICAgY29uc3Qgb2xkSW5kZW50ID0gdGhpcy5saXN0VG9Nb3ZlLmdldEZpcnN0TGluZUluZGVudCgpO1xuICAgIGNvbnN0IG5ld0luZGVudCA9XG4gICAgICB0aGlzLndoZXJlVG9Nb3ZlID09PSBcImluc2lkZVwiXG4gICAgICAgID8gdGhpcy5wbGFjZVRvTW92ZS5nZXRGaXJzdExpbmVJbmRlbnQoKSArIHRoaXMuZGVmYXVsdEluZGVudENoYXJzXG4gICAgICAgIDogdGhpcy5wbGFjZVRvTW92ZS5nZXRGaXJzdExpbmVJbmRlbnQoKTtcbiAgICB0aGlzLmxpc3RUb01vdmUudW5pbmRlbnRDb250ZW50KDAsIG9sZEluZGVudC5sZW5ndGgpO1xuICAgIHRoaXMubGlzdFRvTW92ZS5pbmRlbnRDb250ZW50KDAsIG5ld0luZGVudCk7XG4gIH1cblxuICBwcml2YXRlIHJlc3RvcmVDdXJzb3IoY3Vyc29yQW5jaG9yOiBDdXJzb3JBbmNob3IpIHtcbiAgICBpZiAoY3Vyc29yQW5jaG9yKSB7XG4gICAgICBjb25zdCBjdXJzb3JMaXN0U3RhcnQgPVxuICAgICAgICBjdXJzb3JBbmNob3IuY3Vyc29yTGlzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKTtcblxuICAgICAgdGhpcy5yb290LnJlcGxhY2VDdXJzb3Ioe1xuICAgICAgICBsaW5lOiBjdXJzb3JMaXN0U3RhcnQubGluZSArIGN1cnNvckFuY2hvci5saW5lRGlmZixcbiAgICAgICAgY2g6IGN1cnNvckxpc3RTdGFydC5jaCArIGN1cnNvckFuY2hvci5jaERpZmYsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gV2hlbiB5b3UgbW92ZSBhIGxpc3QsIHRoZSBzY3JlZW4gc2Nyb2xscyB0byB0aGUgY3Vyc29yLlxuICAgICAgLy8gSXQgaXMgYmV0dGVyIHRvIG1vdmUgdGhlIGN1cnNvciBpbnRvIHRoZSB2aWV3cG9ydCB0aGFuIGxldCB0aGUgc2NyZWVuIHNjcm9sbC5cbiAgICAgIHRoaXMucm9vdC5yZXBsYWNlQ3Vyc29yKHRoaXMubGlzdFRvTW92ZS5nZXRMYXN0TGluZUNvbnRlbnRFbmQoKSk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBOb3RpY2UsIFBsYXRmb3JtLCBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgZ2V0SW5kZW50VW5pdCwgaW5kZW50U3RyaW5nIH0gZnJvbSBcIkBjb2RlbWlycm9yL2xhbmd1YWdlXCI7XG5pbXBvcnQgeyBTdGF0ZUVmZmVjdCwgU3RhdGVGaWVsZCB9IGZyb20gXCJAY29kZW1pcnJvci9zdGF0ZVwiO1xuaW1wb3J0IHsgRGVjb3JhdGlvbiwgRGVjb3JhdGlvblNldCwgRWRpdG9yVmlldyB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yLCBnZXRFZGl0b3JGcm9tU3RhdGUgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBNb3ZlTGlzdFRvRGlmZmVyZW50UG9zaXRpb24gfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9Nb3ZlTGlzdFRvRGlmZmVyZW50UG9zaXRpb25cIjtcbmltcG9ydCB7IExpc3QsIFJvb3QsIGNtcFBvcyB9IGZyb20gXCIuLi9yb290XCI7XG5pbXBvcnQgeyBPYnNpZGlhblNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09ic2lkaWFuU2V0dGluZ3NcIjtcbmltcG9ydCB7IE9wZXJhdGlvblBlcmZvcm1lciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PcGVyYXRpb25QZXJmb3JtZXJcIjtcbmltcG9ydCB7IFBhcnNlciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9QYXJzZXJcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzXCI7XG5cbmNvbnN0IEJPRFlfQ0xBU1MgPSBcIm91dGxpbmVyLXBsdWdpbi1kbmRcIjtcblxuZXhwb3J0IGNsYXNzIERyYWdBbmREcm9wIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIHByaXZhdGUgY29udGV4dHNCeURvY3VtZW50ID0gbmV3IE1hcDxEb2N1bWVudCwgRHJhZ0FuZERyb3BEb2N1bWVudENvbnRleHQ+KCk7XG4gIHByaXZhdGUgcHJlU3RhcnQ6IERyYWdBbmREcm9wUHJlU3RhcnRTdGF0ZSB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN0YXRlOiBEcmFnQW5kRHJvcFN0YXRlIHwgbnVsbCA9IG51bGw7XG4gIC8vIEVzY2FwZSBjYW5jZWxzIHRoZSBtb3ZlLCBidXQgdGhlIGdlc3R1cmUncyByZWxlYXNlIG11c3Qgc3RpbGwgbm90IGNsaWNrXG4gIC8vIGl0cyBoYW5kbGUuIE9ubHkgYXJtIGNsaWNrIHN1cHByZXNzaW9uIG9uY2UgdGhhdCBzYW1lIGRvY3VtZW50IGdldHMgbW91c2V1cC5cbiAgcHJpdmF0ZSBjbGlja0dlc3R1cmU6IHtcbiAgICBkb2N1bWVudDogRG9jdW1lbnQ7XG4gICAgcmVsZWFzZWQ6IGJvb2xlYW47XG4gICAgdGltZW91dD86IG51bWJlcjtcbiAgfSB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBvYmlzaWRpYW46IE9ic2lkaWFuU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBwYXJzZXI6IFBhcnNlcixcbiAgICBwcml2YXRlIG9wZXJhdGlvblBlcmZvcm1lcjogT3BlcmF0aW9uUGVyZm9ybWVyLFxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihbXG4gICAgICBkcmFnZ2luZ0xpbmVzU3RhdGVGaWVsZCxcbiAgICAgIGRyb3BwaW5nTGluZXNTdGF0ZUZpZWxkLFxuICAgIF0pO1xuICAgIHRoaXMucGx1Z2luLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLnBsdWdpbi5hcHAud29ya3NwYWNlLm9uKFwid2luZG93LW9wZW5cIiwgKHdvcmtzcGFjZVdpbmRvdywgd2luZG93KSA9PiB7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJEb2N1bWVudCh3b3Jrc3BhY2VXaW5kb3cuZG9jIHx8IHdpbmRvdy5kb2N1bWVudCk7XG4gICAgICB9KSxcbiAgICApO1xuICAgIHRoaXMucGx1Z2luLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLnBsdWdpbi5hcHAud29ya3NwYWNlLm9uKFxuICAgICAgICBcIndpbmRvdy1jbG9zZVwiLFxuICAgICAgICAod29ya3NwYWNlV2luZG93LCB3aW5kb3cpID0+IHtcbiAgICAgICAgICB0aGlzLnVucmVnaXN0ZXJEb2N1bWVudCh3b3Jrc3BhY2VXaW5kb3cuZG9jIHx8IHdpbmRvdy5kb2N1bWVudCk7XG4gICAgICAgIH0sXG4gICAgICApLFxuICAgICk7XG4gICAgdGhpcy5yZWdpc3RlckV4aXN0aW5nRG9jdW1lbnRzKCk7XG4gICAgdGhpcy5lbmFibGVGZWF0dXJlVG9nZ2xlKCk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuY2FuY2VsRHJhZ2dpbmcoKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgZm9yIChjb25zdCBkb2Mgb2YgQXJyYXkuZnJvbSh0aGlzLmNvbnRleHRzQnlEb2N1bWVudC5rZXlzKCkpKSB7XG4gICAgICAgIHRoaXMudW5yZWdpc3RlckRvY3VtZW50KGRvYyk7XG4gICAgICB9XG4gICAgICB0aGlzLmRpc2FibGVGZWF0dXJlVG9nZ2xlKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBlbmFibGVGZWF0dXJlVG9nZ2xlKCkge1xuICAgIHRoaXMuc2V0dGluZ3Mub25DaGFuZ2UodGhpcy5oYW5kbGVTZXR0aW5nc0NoYW5nZSk7XG4gICAgdGhpcy5oYW5kbGVTZXR0aW5nc0NoYW5nZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBkaXNhYmxlRmVhdHVyZVRvZ2dsZSgpIHtcbiAgICB0aGlzLnNldHRpbmdzLnJlbW92ZUNhbGxiYWNrKHRoaXMuaGFuZGxlU2V0dGluZ3NDaGFuZ2UpO1xuICB9XG5cbiAgcHJpdmF0ZSByZWdpc3RlckV4aXN0aW5nRG9jdW1lbnRzKCkge1xuICAgIGNvbnN0IGRvY3MgPSBuZXcgU2V0PERvY3VtZW50PigpO1xuICAgIGRvY3MuYWRkKHRoaXMucGx1Z2luLmFwcC53b3Jrc3BhY2UuY29udGFpbmVyRWwub3duZXJEb2N1bWVudCk7XG4gICAgdGhpcy5wbHVnaW4uYXBwLndvcmtzcGFjZS5pdGVyYXRlQWxsTGVhdmVzKChsZWFmKSA9PiB7XG4gICAgICBkb2NzLmFkZChsZWFmLmdldENvbnRhaW5lcigpLmRvYyk7XG4gICAgfSk7XG5cbiAgICBmb3IgKGNvbnN0IGRvYyBvZiBkb2NzKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVyRG9jdW1lbnQoZG9jKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHJlZ2lzdGVyRG9jdW1lbnQoZG9jOiBEb2N1bWVudCB8IG51bGwgfCB1bmRlZmluZWQpIHtcbiAgICBpZiAoIWRvYyB8fCB0aGlzLmNvbnRleHRzQnlEb2N1bWVudC5oYXMoZG9jKSB8fCAhZG9jLmJvZHkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBkcm9wWm9uZVBhZGRpbmcgPSBkb2MuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBkcm9wWm9uZVBhZGRpbmcuY2xhc3NMaXN0LmFkZChcIm91dGxpbmVyLXBsdWdpbi1kcm9wLXpvbmUtcGFkZGluZ1wiKTtcbiAgICBjb25zdCBkcm9wWm9uZSA9IGRvYy5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIGRyb3Bab25lLmNsYXNzTGlzdC5hZGQoXCJvdXRsaW5lci1wbHVnaW4tZHJvcC16b25lXCIpO1xuICAgIGRyb3Bab25lLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICBkcm9wWm9uZS5hcHBlbmRDaGlsZChkcm9wWm9uZVBhZGRpbmcpO1xuICAgIGRvYy5ib2R5LmFwcGVuZENoaWxkKGRyb3Bab25lKTtcblxuICAgIGNvbnN0IGNvbnRleHQ6IERyYWdBbmREcm9wRG9jdW1lbnRDb250ZXh0ID0ge1xuICAgICAgZG9jdW1lbnQ6IGRvYyxcbiAgICAgIGRyb3Bab25lLFxuICAgICAgZHJvcFpvbmVQYWRkaW5nLFxuICAgIH07XG4gICAgdGhpcy5jb250ZXh0c0J5RG9jdW1lbnQuc2V0KGRvYywgY29udGV4dCk7XG4gICAgLy8gT2JzaWRpYW4gbWF5IGNvcHkgYm9keSBjbGFzc2VzIHdoZW4gY3JlYXRpbmcgYSBuZXcgd2luZG93LlxuICAgIGRvYy5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoXCJvdXRsaW5lci1wbHVnaW4tZHJhZ2dpbmdcIik7XG4gICAgdGhpcy51cGRhdGVCb2R5Q2xhc3MoY29udGV4dCk7XG5cbiAgICBkb2MuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCB0aGlzLmhhbmRsZU1vdXNlRG93biwge1xuICAgICAgY2FwdHVyZTogdHJ1ZSxcbiAgICB9KTtcbiAgICBkb2MuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIHRoaXMuaGFuZGxlQ2xpY2ssIHsgY2FwdHVyZTogdHJ1ZSB9KTtcbiAgICBkb2MuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCB0aGlzLmhhbmRsZU1vdXNlTW92ZSk7XG4gICAgZG9jLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZXVwXCIsIHRoaXMuaGFuZGxlTW91c2VVcCwgeyBjYXB0dXJlOiB0cnVlIH0pO1xuICAgIGRvYy5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCB0aGlzLmhhbmRsZUtleURvd24pO1xuICAgIGRvYy5kZWZhdWx0Vmlldz8uYWRkRXZlbnRMaXN0ZW5lcihcImJsdXJcIiwgdGhpcy5oYW5kbGVXaW5kb3dCbHVyKTtcbiAgfVxuXG4gIHByaXZhdGUgdW5yZWdpc3RlckRvY3VtZW50KGRvYzogRG9jdW1lbnQgfCBudWxsIHwgdW5kZWZpbmVkKSB7XG4gICAgaWYgKCFkb2MpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjb250ZXh0ID0gdGhpcy5jb250ZXh0c0J5RG9jdW1lbnQuZ2V0KGRvYyk7XG4gICAgaWYgKCFjb250ZXh0KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGlmIChcbiAgICAgICAgdGhpcy5wcmVTdGFydD8uZG9jdW1lbnQgPT09IGRvYyB8fFxuICAgICAgICB0aGlzLnN0YXRlPy5jb250ZXh0LmRvY3VtZW50ID09PSBkb2MgfHxcbiAgICAgICAgdGhpcy5jbGlja0dlc3R1cmU/LmRvY3VtZW50ID09PSBkb2NcbiAgICAgICkge1xuICAgICAgICB0aGlzLmNhbmNlbERyYWdnaW5nKCk7XG4gICAgICB9XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGRvYy5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIHRoaXMuaGFuZGxlTW91c2VEb3duLCB7XG4gICAgICAgIGNhcHR1cmU6IHRydWUsXG4gICAgICB9KTtcbiAgICAgIGRvYy5yZW1vdmVFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgdGhpcy5oYW5kbGVDbGljaywgeyBjYXB0dXJlOiB0cnVlIH0pO1xuICAgICAgZG9jLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIiwgdGhpcy5oYW5kbGVNb3VzZU1vdmUpO1xuICAgICAgZG9jLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZXVwXCIsIHRoaXMuaGFuZGxlTW91c2VVcCwgeyBjYXB0dXJlOiB0cnVlIH0pO1xuICAgICAgZG9jLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIHRoaXMuaGFuZGxlS2V5RG93bik7XG4gICAgICBkb2MuZGVmYXVsdFZpZXc/LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJibHVyXCIsIHRoaXMuaGFuZGxlV2luZG93Qmx1cik7XG5cbiAgICAgIGRvYy5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoQk9EWV9DTEFTUyk7XG4gICAgICBkb2MuYm9keS5jbGFzc0xpc3QucmVtb3ZlKFwib3V0bGluZXItcGx1Z2luLWRyYWdnaW5nXCIpO1xuICAgICAgY29udGV4dC5kcm9wWm9uZS5yZW1vdmUoKTtcbiAgICAgIHRoaXMuY29udGV4dHNCeURvY3VtZW50LmRlbGV0ZShkb2MpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0Q29udGV4dEJ5Vmlldyh2aWV3OiBFZGl0b3JWaWV3KSB7XG4gICAgcmV0dXJuIHRoaXMuY29udGV4dHNCeURvY3VtZW50LmdldCh2aWV3LmRvbS5vd25lckRvY3VtZW50KTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlQm9keUNsYXNzKGNvbnRleHQ6IERyYWdBbmREcm9wRG9jdW1lbnRDb250ZXh0KSB7XG4gICAgaWYgKCFpc0ZlYXR1cmVTdXBwb3J0ZWQoKSkge1xuICAgICAgY29udGV4dC5kb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoQk9EWV9DTEFTUyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc2V0dGluZ3MuZHJhZ0FuZERyb3ApIHtcbiAgICAgIGNvbnRleHQuZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuYWRkKEJPRFlfQ0xBU1MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb250ZXh0LmRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LnJlbW92ZShCT0RZX0NMQVNTKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGhhbmRsZVNldHRpbmdzQ2hhbmdlID0gKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBpZiAoIXRoaXMuc2V0dGluZ3MuZHJhZ0FuZERyb3ApIHtcbiAgICAgICAgdGhpcy5jYW5jZWxEcmFnZ2luZygpO1xuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICBmb3IgKGNvbnN0IGNvbnRleHQgb2YgdGhpcy5jb250ZXh0c0J5RG9jdW1lbnQudmFsdWVzKCkpIHtcbiAgICAgICAgdGhpcy51cGRhdGVCb2R5Q2xhc3MoY29udGV4dCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIHByaXZhdGUgaGFuZGxlTW91c2VEb3duID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAvLyBBIG5ldyBnZXN0dXJlIG11c3QgbmV2ZXIgb3ZlcndyaXRlIGFub3RoZXIgZG9jdW1lbnQncyBkcmFnIG93bmVyLlxuICAgIHRoaXMuY2FuY2VsRHJhZ2dpbmcoKTtcbiAgICBpZiAoXG4gICAgICAhaXNGZWF0dXJlU3VwcG9ydGVkKCkgfHxcbiAgICAgICF0aGlzLnNldHRpbmdzLmRyYWdBbmREcm9wIHx8XG4gICAgICBlLmJ1dHRvbiAhPT0gMCB8fFxuICAgICAgIWlzQ2xpY2tPbkJ1bGxldChlKVxuICAgICkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHZpZXcgPSBnZXRFZGl0b3JWaWV3RnJvbUhUTUxFbGVtZW50KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KTtcbiAgICBpZiAoIXZpZXcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcblxuICAgIGNvbnN0IGNvbnRleHQgPSB0aGlzLmdldENvbnRleHRCeVZpZXcodmlldyk7XG4gICAgaWYgKCFjb250ZXh0KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5wcmVTdGFydCA9IHtcbiAgICAgIHg6IGUuY2xpZW50WCxcbiAgICAgIHk6IGUuY2xpZW50WSxcbiAgICAgIHZpZXcsXG4gICAgICBkb2N1bWVudDogY29udGV4dC5kb2N1bWVudCxcbiAgICB9O1xuICB9O1xuXG4gIHByaXZhdGUgaGFuZGxlTW91c2VNb3ZlID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICBjb25zdCBldmVudERvY3VtZW50ID0gZ2V0RXZlbnREb2N1bWVudChlKTtcblxuICAgIGlmICgoZS5idXR0b25zICYgMSkgPT09IDApIHtcbiAgICAgIHRoaXMuY2FuY2VsRHJhZ2dpbmcoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHRoaXMucHJlU3RhcnQgJiYgZXZlbnREb2N1bWVudCA9PT0gdGhpcy5wcmVTdGFydC5kb2N1bWVudCkge1xuICAgICAgdGhpcy5zdGFydERyYWdnaW5nKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLnN0YXRlICYmIGV2ZW50RG9jdW1lbnQgPT09IHRoaXMuc3RhdGUuY29udGV4dC5kb2N1bWVudCkge1xuICAgICAgdGhpcy5kZXRlY3RBbmREcmF3RHJvcFpvbmUoZS5jbGllbnRYLCBlLmNsaWVudFkpO1xuICAgIH1cbiAgfTtcblxuICBwcml2YXRlIGhhbmRsZU1vdXNlVXAgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgIHRoaXMucHJlU3RhcnQgPSBudWxsO1xuICAgIGNvbnN0IGdlc3R1cmUgPSB0aGlzLmNsaWNrR2VzdHVyZTtcbiAgICBpZiAoZS5idXR0b24gPT09IDAgJiYgZ2VzdHVyZT8uZG9jdW1lbnQgPT09IGdldEV2ZW50RG9jdW1lbnQoZSkpIHtcbiAgICAgIGdlc3R1cmUucmVsZWFzZWQgPSB0cnVlO1xuICAgICAgLy8gTmF0aXZlIGNsaWNrIGlzIGRpc3BhdGNoZWQgd2l0aCBtb3VzZXVwLCBiZWZvcmUgdGhlIG5leHQgdGltZXIgdGFzay5cbiAgICAgIC8vIElmIHRoZXJlIGlzIG5vIGNsaWNrLCBkb24ndCBsZWF2ZSBzdXBwcmVzc2lvbiBhcm1lZCBmb3IgbGF0ZXIgaW5wdXQuXG4gICAgICBnZXN0dXJlLnRpbWVvdXQgPSBnZXN0dXJlLmRvY3VtZW50LmRlZmF1bHRWaWV3Py5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuY2xpY2tHZXN0dXJlID09PSBnZXN0dXJlKSB7XG4gICAgICAgICAgdGhpcy5jbGVhckNsaWNrR2VzdHVyZSgpO1xuICAgICAgICB9XG4gICAgICB9LCAwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jbGVhckNsaWNrR2VzdHVyZSgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5zdGF0ZSAmJiBnZXRFdmVudERvY3VtZW50KGUpID09PSB0aGlzLnN0YXRlLmNvbnRleHQuZG9jdW1lbnQpIHtcbiAgICAgIHRoaXMuc3RvcERyYWdnaW5nKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFJlbGVhc2luZyBpbiBhbm90aGVyIHdpbmRvdyBjYW5jZWxzOyBpdCBpcyBub3QgYSBjcm9zcy13aW5kb3cgZHJvcC5cbiAgICAgIC8vIEFuIEVzY2FwZS1jYW5jZWxsZWQgZ2VzdHVyZSBzdGlsbCBuZWVkcyBpdHMgbWF0Y2hpbmcgY2xpY2sgc3VwcHJlc3NlZC5cbiAgICAgIHRoaXMuY2FuY2VsRHJhZ2dpbmcodHJ1ZSk7XG4gICAgfVxuICB9O1xuXG4gIHByaXZhdGUgaGFuZGxlQ2xpY2sgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgIGlmIChcbiAgICAgICF0aGlzLmNsaWNrR2VzdHVyZT8ucmVsZWFzZWQgfHxcbiAgICAgIHRoaXMuY2xpY2tHZXN0dXJlLmRvY3VtZW50ICE9PSBnZXRFdmVudERvY3VtZW50KGUpIHx8XG4gICAgICAhZS5pc1RydXN0ZWQgfHxcbiAgICAgIGUuYnV0dG9uICE9PSAwIHx8XG4gICAgICBlLmRldGFpbCA9PT0gMFxuICAgICkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLmNsZWFyQ2xpY2tHZXN0dXJlKCk7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gIH07XG5cbiAgcHJpdmF0ZSBoYW5kbGVLZXlEb3duID0gKGU6IEtleWJvYXJkRXZlbnQpID0+IHtcbiAgICBpZiAoZS5jb2RlID09PSBcIkVzY2FwZVwiKSB7XG4gICAgICB0aGlzLmNhbmNlbERyYWdnaW5nKHRydWUpO1xuICAgIH1cbiAgfTtcblxuICBwcml2YXRlIGhhbmRsZVdpbmRvd0JsdXIgPSAoZTogRXZlbnQpID0+IHtcbiAgICBjb25zdCBvd25lciA9XG4gICAgICB0aGlzLnN0YXRlPy5jb250ZXh0LmRvY3VtZW50IHx8XG4gICAgICB0aGlzLnByZVN0YXJ0Py5kb2N1bWVudCB8fFxuICAgICAgdGhpcy5jbGlja0dlc3R1cmU/LmRvY3VtZW50O1xuICAgIGlmIChvd25lcj8uZGVmYXVsdFZpZXcgPT09IGUuY3VycmVudFRhcmdldCkge1xuICAgICAgdGhpcy5jYW5jZWxEcmFnZ2luZygpO1xuICAgIH1cbiAgfTtcblxuICBwcml2YXRlIHN0YXJ0RHJhZ2dpbmcoKSB7XG4gICAgY29uc3QgeyB4LCB5LCB2aWV3IH0gPSB0aGlzLnByZVN0YXJ0O1xuICAgIHRoaXMucHJlU3RhcnQgPSBudWxsO1xuXG4gICAgY29uc3QgZWRpdG9yID0gZ2V0RWRpdG9yRnJvbVN0YXRlKHZpZXcuc3RhdGUpO1xuICAgIGlmICghZWRpdG9yKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZHJvcENvbnRleHQgPSB0aGlzLmdldENvbnRleHRCeVZpZXcodmlldyk7XG4gICAgaWYgKCFkcm9wQ29udGV4dCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHBvc09mZnNldCA9IHZpZXcucG9zQXRDb29yZHMoeyB4LCB5IH0pO1xuICAgIGlmIChwb3NPZmZzZXQgPT09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgcG9zID0gZWRpdG9yLm9mZnNldFRvUG9zKHBvc09mZnNldCk7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMucGFyc2VyLnBhcnNlKGVkaXRvciwgcG9zKTtcbiAgICBpZiAoIXJvb3QpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJMaW5lKHBvcy5saW5lKTtcbiAgICBpZiAoIWxpc3QpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgc3RhdGUgPSBuZXcgRHJhZ0FuZERyb3BTdGF0ZShkcm9wQ29udGV4dCwgdmlldywgZWRpdG9yLCByb290LCBsaXN0KTtcblxuICAgIGlmICghc3RhdGUuaGFzRHJvcFZhcmlhbnRzKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnN0YXRlID0gc3RhdGU7XG4gICAgdGhpcy5jbGlja0dlc3R1cmUgPSB7IGRvY3VtZW50OiBkcm9wQ29udGV4dC5kb2N1bWVudCwgcmVsZWFzZWQ6IGZhbHNlIH07XG4gICAgdGhpcy5oaWdobGlnaHREcmFnZ2luZ0xpbmVzKCk7XG4gIH1cblxuICBwcml2YXRlIGRldGVjdEFuZERyYXdEcm9wWm9uZSh4OiBudW1iZXIsIHk6IG51bWJlcikge1xuICAgIHRoaXMuc3RhdGUuY2FsY3VsYXRlTmVhcmVzdERyb3BWYXJpYW50KHgsIHkpO1xuICAgIHRoaXMuZHJhd0Ryb3Bab25lKCk7XG4gIH1cblxuICBwcml2YXRlIGNsZWFyQ2xpY2tHZXN0dXJlKCkge1xuICAgIGlmICh0aGlzLmNsaWNrR2VzdHVyZT8udGltZW91dCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmNsaWNrR2VzdHVyZS5kb2N1bWVudC5kZWZhdWx0Vmlldz8uY2xlYXJUaW1lb3V0KFxuICAgICAgICB0aGlzLmNsaWNrR2VzdHVyZS50aW1lb3V0LFxuICAgICAgKTtcbiAgICB9XG4gICAgdGhpcy5jbGlja0dlc3R1cmUgPSBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBjYW5jZWxEcmFnZ2luZyhwcmVzZXJ2ZUNsaWNrR2VzdHVyZSA9IGZhbHNlKSB7XG4gICAgaWYgKCFwcmVzZXJ2ZUNsaWNrR2VzdHVyZSkge1xuICAgICAgdGhpcy5jbGVhckNsaWNrR2VzdHVyZSgpO1xuICAgIH1cbiAgICB0aGlzLnN0b3BEcmFnZ2luZyhmYWxzZSk7XG4gIH1cblxuICBwcml2YXRlIHN0b3BEcmFnZ2luZyhhcHBseUNoYW5nZXMgPSB0cnVlKSB7XG4gICAgY29uc3Qgc3RhdGUgPSB0aGlzLnN0YXRlO1xuICAgIHRoaXMucHJlU3RhcnQgPSBudWxsO1xuICAgIHRoaXMuc3RhdGUgPSBudWxsO1xuICAgIGlmICghc3RhdGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBSZWxlYXNlIG93bmVyc2hpcCBhbmQgRE9NIGV2ZW4gaWYgZGlzcGF0Y2ggZmFpbHMgb24gYSBjbG9zaW5nIGVkaXRvci5cbiAgICBzdGF0ZS5jb250ZXh0LmRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LnJlbW92ZShcIm91dGxpbmVyLXBsdWdpbi1kcmFnZ2luZ1wiKTtcbiAgICBzdGF0ZS5jb250ZXh0LmRyb3Bab25lLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICBzdGF0ZS52aWV3LmRpc3BhdGNoKHsgZWZmZWN0czogW2RuZEVuZGVkLm9mKCldIH0pO1xuICAgIGlmIChhcHBseUNoYW5nZXMpIHtcbiAgICAgIHRoaXMuYXBwbHlDaGFuZ2VzKHN0YXRlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFwcGx5Q2hhbmdlcyhzdGF0ZTogRHJhZ0FuZERyb3BTdGF0ZSkge1xuICAgIGNvbnN0IHsgZHJvcFZhcmlhbnQsIGVkaXRvciwgcm9vdCwgbGlzdCB9ID0gc3RhdGU7XG4gICAgaWYgKCFkcm9wVmFyaWFudCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG5ld1Jvb3QgPSB0aGlzLnBhcnNlci5wYXJzZShlZGl0b3IsIHJvb3QuZ2V0Q29udGVudFN0YXJ0KCkpO1xuICAgIGlmICghbmV3Um9vdCB8fCAhaXNTYW1lUm9vdHMocm9vdCwgbmV3Um9vdCkpIHtcbiAgICAgIG5ldyBOb3RpY2UoXG4gICAgICAgIGBUaGUgaXRlbSBjYW5ub3QgYmUgbW92ZWQuIFRoZSBwYWdlIGNvbnRlbnQgY2hhbmdlZCBkdXJpbmcgdGhlIG1vdmUuYCxcbiAgICAgICAgNTAwMCxcbiAgICAgICk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIuZXZhbChcbiAgICAgIHJvb3QsXG4gICAgICBuZXcgTW92ZUxpc3RUb0RpZmZlcmVudFBvc2l0aW9uKFxuICAgICAgICByb290LFxuICAgICAgICBsaXN0LFxuICAgICAgICBkcm9wVmFyaWFudC5wbGFjZVRvTW92ZSxcbiAgICAgICAgZHJvcFZhcmlhbnQud2hlcmVUb01vdmUsXG4gICAgICAgIHRoaXMub2Jpc2lkaWFuLmdldERlZmF1bHRJbmRlbnRDaGFycygpLFxuICAgICAgKSxcbiAgICAgIGVkaXRvcixcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBoaWdobGlnaHREcmFnZ2luZ0xpbmVzKCkge1xuICAgIGNvbnN0IHsgc3RhdGUgfSA9IHRoaXM7XG4gICAgY29uc3QgeyBsaXN0LCBlZGl0b3IsIHZpZXcgfSA9IHN0YXRlO1xuXG4gICAgY29uc3QgbGluZXMgPSBbXTtcbiAgICBjb25zdCBmcm9tTGluZSA9IGxpc3QuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZTtcbiAgICBjb25zdCB0aWxsTGluZSA9IGxpc3QuZ2V0Q29udGVudEVuZEluY2x1ZGluZ0NoaWxkcmVuKCkubGluZTtcbiAgICBmb3IgKGxldCBpID0gZnJvbUxpbmU7IGkgPD0gdGlsbExpbmU7IGkrKykge1xuICAgICAgbGluZXMucHVzaChlZGl0b3IucG9zVG9PZmZzZXQoeyBsaW5lOiBpLCBjaDogMCB9KSk7XG4gICAgfVxuICAgIHZpZXcuZGlzcGF0Y2goe1xuICAgICAgZWZmZWN0czogW2RuZFN0YXJ0ZWQub2YobGluZXMpXSxcbiAgICB9KTtcblxuICAgIHN0YXRlLmNvbnRleHQuZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuYWRkKFwib3V0bGluZXItcGx1Z2luLWRyYWdnaW5nXCIpO1xuICB9XG5cbiAgcHJpdmF0ZSBkcmF3RHJvcFpvbmUoKSB7XG4gICAgY29uc3QgeyBzdGF0ZSB9ID0gdGhpcztcbiAgICBjb25zdCB7IHZpZXcsIGVkaXRvciwgZHJvcFZhcmlhbnQgfSA9IHN0YXRlO1xuICAgIGNvbnN0IHsgZHJvcFpvbmUsIGRyb3Bab25lUGFkZGluZywgZG9jdW1lbnQgfSA9IHN0YXRlLmNvbnRleHQ7XG5cbiAgICBjb25zdCBuZXdQYXJlbnQgPVxuICAgICAgZHJvcFZhcmlhbnQud2hlcmVUb01vdmUgPT09IFwiaW5zaWRlXCJcbiAgICAgICAgPyBkcm9wVmFyaWFudC5wbGFjZVRvTW92ZVxuICAgICAgICA6IGRyb3BWYXJpYW50LnBsYWNlVG9Nb3ZlLmdldFBhcmVudCgpO1xuICAgIGNvbnN0IG5ld1BhcmVudElzUm9vdExpc3QgPSAhbmV3UGFyZW50LmdldFBhcmVudCgpO1xuXG4gICAge1xuICAgICAgY29uc3Qgd2lkdGggPSBNYXRoLnJvdW5kKFxuICAgICAgICB2aWV3LmNvbnRlbnRET00ub2Zmc2V0V2lkdGggLVxuICAgICAgICAgIChkcm9wVmFyaWFudC5sZWZ0IC0gdGhpcy5zdGF0ZS5sZWZ0UGFkZGluZyksXG4gICAgICApO1xuXG4gICAgICBkcm9wWm9uZS5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICAgICAgZHJvcFpvbmUuc3R5bGUudG9wID0gZHJvcFZhcmlhbnQudG9wICsgXCJweFwiO1xuICAgICAgZHJvcFpvbmUuc3R5bGUubGVmdCA9IGRyb3BWYXJpYW50LmxlZnQgKyBcInB4XCI7XG4gICAgICBkcm9wWm9uZS5zdHlsZS53aWR0aCA9IHdpZHRoICsgXCJweFwiO1xuICAgIH1cblxuICAgIHtcbiAgICAgIGNvbnN0IGxldmVsID0gbmV3UGFyZW50LmdldExldmVsKCk7XG4gICAgICBjb25zdCBpbmRlbnRXaWR0aCA9IHRoaXMuc3RhdGUudGFiV2lkdGg7XG4gICAgICBjb25zdCB3aWR0aCA9IGluZGVudFdpZHRoICogbGV2ZWw7XG4gICAgICBjb25zdCBkYXNoUGFkZGluZyA9IDM7XG4gICAgICBjb25zdCBkYXNoV2lkdGggPSBpbmRlbnRXaWR0aCAtIGRhc2hQYWRkaW5nO1xuICAgICAgY29uc3QgY29sb3IgPSBnZXRDb21wdXRlZFN0eWxlKGRvY3VtZW50LmJvZHkpLmdldFByb3BlcnR5VmFsdWUoXG4gICAgICAgIFwiLS1jb2xvci1hY2NlbnRcIixcbiAgICAgICk7XG5cbiAgICAgIGRyb3Bab25lUGFkZGluZy5zdHlsZS53aWR0aCA9IGAke3dpZHRofXB4YDtcbiAgICAgIGRyb3Bab25lUGFkZGluZy5zdHlsZS5tYXJnaW5MZWZ0ID0gYC0ke3dpZHRofXB4YDtcbiAgICAgIGRyb3Bab25lUGFkZGluZy5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBgdXJsKCdkYXRhOmltYWdlL3N2Zyt4bWwsJTNDc3ZnJTIwdmlld0JveCUzRCUyMjAlMjAwJTIwJHt3aWR0aH0lMjA0JTIyJTIweG1sbnMlM0QlMjJodHRwJTNBJTJGJTJGd3d3LnczLm9yZyUyRjIwMDAlMkZzdmclMjIlM0UlM0NsaW5lJTIweDElM0QlMjIwJTIyJTIweTElM0QlMjIwJTIyJTIweDIlM0QlMjIke3dpZHRofSUyMiUyMHkyJTNEJTIyMCUyMiUyMHN0cm9rZSUzRCUyMiR7Y29sb3J9JTIyJTIwc3Ryb2tlLXdpZHRoJTNEJTIyOCUyMiUyMHN0cm9rZS1kYXNoYXJyYXklM0QlMjIke2Rhc2hXaWR0aH0lMjAke2Rhc2hQYWRkaW5nfSUyMiUyRiUzRSUzQyUyRnN2ZyUzRScpYDtcbiAgICB9XG5cbiAgICB0aGlzLnN0YXRlLnZpZXcuZGlzcGF0Y2goe1xuICAgICAgZWZmZWN0czogW1xuICAgICAgICBkbmRNb3ZlZC5vZihcbiAgICAgICAgICBuZXdQYXJlbnRJc1Jvb3RMaXN0XG4gICAgICAgICAgICA/IG51bGxcbiAgICAgICAgICAgIDogZWRpdG9yLnBvc1RvT2Zmc2V0KHtcbiAgICAgICAgICAgICAgICBsaW5lOiBuZXdQYXJlbnQuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZSxcbiAgICAgICAgICAgICAgICBjaDogMCxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICksXG4gICAgICBdLFxuICAgIH0pO1xuICB9XG59XG5cbmludGVyZmFjZSBEcm9wVmFyaWFudCB7XG4gIGxpbmU6IG51bWJlcjtcbiAgbGV2ZWw6IG51bWJlcjtcbiAgbGVmdDogbnVtYmVyO1xuICB0b3A6IG51bWJlcjtcbiAgcGxhY2VUb01vdmU6IExpc3Q7XG4gIHdoZXJlVG9Nb3ZlOiBcImFmdGVyXCIgfCBcImJlZm9yZVwiIHwgXCJpbnNpZGVcIjtcbn1cblxuaW50ZXJmYWNlIERyYWdBbmREcm9wUHJlU3RhcnRTdGF0ZSB7XG4gIHg6IG51bWJlcjtcbiAgeTogbnVtYmVyO1xuICB2aWV3OiBFZGl0b3JWaWV3O1xuICBkb2N1bWVudDogRG9jdW1lbnQ7XG59XG5cbmludGVyZmFjZSBEcmFnQW5kRHJvcERvY3VtZW50Q29udGV4dCB7XG4gIGRvY3VtZW50OiBEb2N1bWVudDtcbiAgZHJvcFpvbmU6IEhUTUxEaXZFbGVtZW50O1xuICBkcm9wWm9uZVBhZGRpbmc6IEhUTUxEaXZFbGVtZW50O1xufVxuXG5jbGFzcyBEcmFnQW5kRHJvcFN0YXRlIHtcbiAgcHJpdmF0ZSBkcm9wVmFyaWFudHM6IE1hcDxzdHJpbmcsIERyb3BWYXJpYW50PiA9IG5ldyBNYXAoKTtcbiAgcHVibGljIGRyb3BWYXJpYW50OiBEcm9wVmFyaWFudCA9IG51bGw7XG4gIHB1YmxpYyBsZWZ0UGFkZGluZyA9IDA7XG4gIHB1YmxpYyB0YWJXaWR0aCA9IDA7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIHJlYWRvbmx5IGNvbnRleHQ6IERyYWdBbmREcm9wRG9jdW1lbnRDb250ZXh0LFxuICAgIHB1YmxpYyByZWFkb25seSB2aWV3OiBFZGl0b3JWaWV3LFxuICAgIHB1YmxpYyByZWFkb25seSBlZGl0b3I6IE15RWRpdG9yLFxuICAgIHB1YmxpYyByZWFkb25seSByb290OiBSb290LFxuICAgIHB1YmxpYyByZWFkb25seSBsaXN0OiBMaXN0LFxuICApIHtcbiAgICB0aGlzLmNvbGxlY3REcm9wVmFyaWFudHMoKTtcbiAgICB0aGlzLmNhbGN1bGF0ZUxlZnRQYWRkaW5nKCk7XG4gICAgdGhpcy5jYWxjdWxhdGVUYWJXaWR0aCgpO1xuICB9XG5cbiAgZ2V0RHJvcFZhcmlhbnRzKCkge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMuZHJvcFZhcmlhbnRzLnZhbHVlcygpKTtcbiAgfVxuXG4gIGhhc0Ryb3BWYXJpYW50cygpIHtcbiAgICByZXR1cm4gdGhpcy5kcm9wVmFyaWFudHMuc2l6ZSA+IDA7XG4gIH1cblxuICBjYWxjdWxhdGVOZWFyZXN0RHJvcFZhcmlhbnQoeDogbnVtYmVyLCB5OiBudW1iZXIpIHtcbiAgICBjb25zdCB7IHZpZXcsIGVkaXRvciB9ID0gdGhpcztcblxuICAgIGNvbnN0IGRyb3BWYXJpYW50cyA9IHRoaXMuZ2V0RHJvcFZhcmlhbnRzKCk7XG4gICAgY29uc3QgcG9zc2libGVEcm9wVmFyaWFudHMgPSBbXTtcblxuICAgIGZvciAoY29uc3QgdiBvZiBkcm9wVmFyaWFudHMpIHtcbiAgICAgIGNvbnN0IHsgcGxhY2VUb01vdmUgfSA9IHY7XG5cbiAgICAgIGNvbnN0IHBvc2l0aW9uQWZ0ZXJMaXN0ID1cbiAgICAgICAgdi53aGVyZVRvTW92ZSA9PT0gXCJhZnRlclwiIHx8IHYud2hlcmVUb01vdmUgPT09IFwiaW5zaWRlXCI7XG4gICAgICBjb25zdCBsaW5lID0gcG9zaXRpb25BZnRlckxpc3RcbiAgICAgICAgPyBwbGFjZVRvTW92ZS5nZXRDb250ZW50RW5kSW5jbHVkaW5nQ2hpbGRyZW4oKS5saW5lXG4gICAgICAgIDogcGxhY2VUb01vdmUuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZTtcbiAgICAgIGNvbnN0IGxpbmVQb3MgPSBlZGl0b3IucG9zVG9PZmZzZXQoe1xuICAgICAgICBsaW5lLFxuICAgICAgICBjaDogMCxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBjb29yZHMgPSB2aWV3LmNvb3Jkc0F0UG9zKGxpbmVQb3MsIC0xKTtcblxuICAgICAgaWYgKCFjb29yZHMpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHYubGVmdCA9IHRoaXMubGVmdFBhZGRpbmcgKyAodi5sZXZlbCAtIDEpICogdGhpcy50YWJXaWR0aDtcbiAgICAgIHYudG9wID0gY29vcmRzLnRvcDtcblxuICAgICAgaWYgKHBvc2l0aW9uQWZ0ZXJMaXN0KSB7XG4gICAgICAgIHYudG9wICs9IHZpZXcubGluZUJsb2NrQXQobGluZVBvcykuaGVpZ2h0O1xuICAgICAgfVxuXG4gICAgICAvLyBCZXR0ZXIgdmVydGljYWwgYWxpZ25tZW50XG4gICAgICB2LnRvcCAtPSA4O1xuXG4gICAgICBwb3NzaWJsZURyb3BWYXJpYW50cy5wdXNoKHYpO1xuICAgIH1cblxuICAgIGNvbnN0IG5lYXJlc3RMaW5lVG9wID0gcG9zc2libGVEcm9wVmFyaWFudHNcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBNYXRoLmFicyh5IC0gYS50b3ApIC0gTWF0aC5hYnMoeSAtIGIudG9wKSlcbiAgICAgIC5maXJzdCgpLnRvcDtcblxuICAgIGNvbnN0IHZhcmlhbnNPbk5lYXJlc3RMaW5lID0gcG9zc2libGVEcm9wVmFyaWFudHMuZmlsdGVyKFxuICAgICAgKHYpID0+IE1hdGguYWJzKHYudG9wIC0gbmVhcmVzdExpbmVUb3ApIDw9IDQsXG4gICAgKTtcblxuICAgIHRoaXMuZHJvcFZhcmlhbnQgPSB2YXJpYW5zT25OZWFyZXN0TGluZVxuICAgICAgLnNvcnQoKGEsIGIpID0+IE1hdGguYWJzKHggLSBhLmxlZnQpIC0gTWF0aC5hYnMoeCAtIGIubGVmdCkpXG4gICAgICAuZmlyc3QoKTtcbiAgfVxuXG4gIHByaXZhdGUgYWRkRHJvcFZhcmlhbnQodjogRHJvcFZhcmlhbnQpIHtcbiAgICB0aGlzLmRyb3BWYXJpYW50cy5zZXQoYCR7di5saW5lfSAke3YubGV2ZWx9YCwgdik7XG4gIH1cblxuICBwcml2YXRlIGNvbGxlY3REcm9wVmFyaWFudHMoKSB7XG4gICAgY29uc3QgdmlzaXQgPSAobGlzdHM6IExpc3RbXSkgPT4ge1xuICAgICAgZm9yIChjb25zdCBwbGFjZVRvTW92ZSBvZiBsaXN0cykge1xuICAgICAgICBjb25zdCBsaW5lQmVmb3JlID0gcGxhY2VUb01vdmUuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZTtcbiAgICAgICAgY29uc3QgbGluZUFmdGVyID0gcGxhY2VUb01vdmUuZ2V0Q29udGVudEVuZEluY2x1ZGluZ0NoaWxkcmVuKCkubGluZSArIDE7XG5cbiAgICAgICAgY29uc3QgbGV2ZWwgPSBwbGFjZVRvTW92ZS5nZXRMZXZlbCgpO1xuXG4gICAgICAgIHRoaXMuYWRkRHJvcFZhcmlhbnQoe1xuICAgICAgICAgIGxpbmU6IGxpbmVCZWZvcmUsXG4gICAgICAgICAgbGV2ZWwsXG4gICAgICAgICAgbGVmdDogMCxcbiAgICAgICAgICB0b3A6IDAsXG4gICAgICAgICAgcGxhY2VUb01vdmUsXG4gICAgICAgICAgd2hlcmVUb01vdmU6IFwiYmVmb3JlXCIsXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmFkZERyb3BWYXJpYW50KHtcbiAgICAgICAgICBsaW5lOiBsaW5lQWZ0ZXIsXG4gICAgICAgICAgbGV2ZWwsXG4gICAgICAgICAgbGVmdDogMCxcbiAgICAgICAgICB0b3A6IDAsXG4gICAgICAgICAgcGxhY2VUb01vdmUsXG4gICAgICAgICAgd2hlcmVUb01vdmU6IFwiYWZ0ZXJcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHBsYWNlVG9Nb3ZlID09PSB0aGlzLmxpc3QpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwbGFjZVRvTW92ZS5pc0VtcHR5KCkpIHtcbiAgICAgICAgICB0aGlzLmFkZERyb3BWYXJpYW50KHtcbiAgICAgICAgICAgIGxpbmU6IGxpbmVBZnRlcixcbiAgICAgICAgICAgIGxldmVsOiBsZXZlbCArIDEsXG4gICAgICAgICAgICBsZWZ0OiAwLFxuICAgICAgICAgICAgdG9wOiAwLFxuICAgICAgICAgICAgcGxhY2VUb01vdmUsXG4gICAgICAgICAgICB3aGVyZVRvTW92ZTogXCJpbnNpZGVcIixcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2aXNpdChwbGFjZVRvTW92ZS5nZXRDaGlsZHJlbigpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICB2aXNpdCh0aGlzLnJvb3QuZ2V0Q2hpbGRyZW4oKSk7XG4gIH1cblxuICBwcml2YXRlIGNhbGN1bGF0ZUxlZnRQYWRkaW5nKCkge1xuICAgIGNvbnN0IGNtTGluZSA9IHRoaXMudmlldy5kb20ucXVlcnlTZWxlY3RvcihcImRpdi5jbS1saW5lXCIpO1xuICAgIHRoaXMubGVmdFBhZGRpbmcgPSBjbUxpbmUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkubGVmdDtcbiAgfVxuXG4gIHByaXZhdGUgY2FsY3VsYXRlVGFiV2lkdGgoKSB7XG4gICAgY29uc3QgeyB2aWV3IH0gPSB0aGlzO1xuXG4gICAgY29uc3QgaW5kZW50RG9tID0gdmlldy5kb20ucXVlcnlTZWxlY3RvcihcIi5jbS1pbmRlbnRcIik7XG4gICAgaWYgKGluZGVudERvbSkge1xuICAgICAgdGhpcy50YWJXaWR0aCA9IChpbmRlbnREb20gYXMgSFRNTEVsZW1lbnQpLm9mZnNldFdpZHRoO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHNpbmdsZUluZGVudCA9IGluZGVudFN0cmluZyh2aWV3LnN0YXRlLCBnZXRJbmRlbnRVbml0KHZpZXcuc3RhdGUpKTtcblxuICAgIGZvciAobGV0IGkgPSAxOyBpIDw9IHZpZXcuc3RhdGUuZG9jLmxpbmVzOyBpKyspIHtcbiAgICAgIGNvbnN0IGxpbmUgPSB2aWV3LnN0YXRlLmRvYy5saW5lKGkpO1xuXG4gICAgICBpZiAobGluZS50ZXh0LnN0YXJ0c1dpdGgoc2luZ2xlSW5kZW50KSkge1xuICAgICAgICBjb25zdCBhID0gdmlldy5jb29yZHNBdFBvcyhsaW5lLmZyb20sIC0xKTtcbiAgICAgICAgaWYgKCFhKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBiID0gdmlldy5jb29yZHNBdFBvcyhsaW5lLmZyb20gKyBzaW5nbGVJbmRlbnQubGVuZ3RoLCAtMSk7XG4gICAgICAgIGlmICghYikge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy50YWJXaWR0aCA9IGIubGVmdCAtIGEubGVmdDtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMudGFiV2lkdGggPSB2aWV3LmRlZmF1bHRDaGFyYWN0ZXJXaWR0aCAqIGdldEluZGVudFVuaXQodmlldy5zdGF0ZSk7XG4gIH1cbn1cblxuY29uc3QgZG5kU3RhcnRlZCA9IFN0YXRlRWZmZWN0LmRlZmluZTxudW1iZXJbXT4oe1xuICBtYXA6IChsaW5lcywgY2hhbmdlKSA9PiBsaW5lcy5tYXAoKGwpID0+IGNoYW5nZS5tYXBQb3MobCkpLFxufSk7XG5cbmNvbnN0IGRuZE1vdmVkID0gU3RhdGVFZmZlY3QuZGVmaW5lPG51bWJlciB8IG51bGw+KHtcbiAgbWFwOiAobGluZSwgY2hhbmdlKSA9PiAobGluZSAhPT0gbnVsbCA/IGNoYW5nZS5tYXBQb3MobGluZSkgOiBsaW5lKSxcbn0pO1xuXG5jb25zdCBkbmRFbmRlZCA9IFN0YXRlRWZmZWN0LmRlZmluZTx2b2lkPigpO1xuXG5jb25zdCBkcmFnZ2luZ0xpbmVEZWNvcmF0aW9uID0gRGVjb3JhdGlvbi5saW5lKHtcbiAgY2xhc3M6IFwib3V0bGluZXItcGx1Z2luLWRyYWdnaW5nLWxpbmVcIixcbn0pO1xuXG5jb25zdCBkcm9wcGluZ0xpbmVEZWNvcmF0aW9uID0gRGVjb3JhdGlvbi5saW5lKHtcbiAgY2xhc3M6IFwib3V0bGluZXItcGx1Z2luLWRyb3BwaW5nLWxpbmVcIixcbn0pO1xuXG5jb25zdCBkcmFnZ2luZ0xpbmVzU3RhdGVGaWVsZCA9IFN0YXRlRmllbGQuZGVmaW5lPERlY29yYXRpb25TZXQ+KHtcbiAgY3JlYXRlOiAoKSA9PiBEZWNvcmF0aW9uLm5vbmUsXG5cbiAgdXBkYXRlOiAoZG5kU3RhdGUsIHRyKSA9PiB7XG4gICAgZG5kU3RhdGUgPSBkbmRTdGF0ZS5tYXAodHIuY2hhbmdlcyk7XG5cbiAgICBmb3IgKGNvbnN0IGUgb2YgdHIuZWZmZWN0cykge1xuICAgICAgaWYgKGUuaXMoZG5kU3RhcnRlZCkpIHtcbiAgICAgICAgZG5kU3RhdGUgPSBkbmRTdGF0ZS51cGRhdGUoe1xuICAgICAgICAgIGFkZDogZS52YWx1ZS5tYXAoKGwpID0+IGRyYWdnaW5nTGluZURlY29yYXRpb24ucmFuZ2UobCwgbCkpLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgaWYgKGUuaXMoZG5kRW5kZWQpKSB7XG4gICAgICAgIGRuZFN0YXRlID0gRGVjb3JhdGlvbi5ub25lO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBkbmRTdGF0ZTtcbiAgfSxcblxuICBwcm92aWRlOiAoZikgPT4gRWRpdG9yVmlldy5kZWNvcmF0aW9ucy5mcm9tKGYpLFxufSk7XG5cbmNvbnN0IGRyb3BwaW5nTGluZXNTdGF0ZUZpZWxkID0gU3RhdGVGaWVsZC5kZWZpbmU8RGVjb3JhdGlvblNldD4oe1xuICBjcmVhdGU6ICgpID0+IERlY29yYXRpb24ubm9uZSxcblxuICB1cGRhdGU6IChkbmREcm9wcGluZ1N0YXRlLCB0cikgPT4ge1xuICAgIGRuZERyb3BwaW5nU3RhdGUgPSBkbmREcm9wcGluZ1N0YXRlLm1hcCh0ci5jaGFuZ2VzKTtcblxuICAgIGZvciAoY29uc3QgZSBvZiB0ci5lZmZlY3RzKSB7XG4gICAgICBpZiAoZS5pcyhkbmRNb3ZlZCkpIHtcbiAgICAgICAgZG5kRHJvcHBpbmdTdGF0ZSA9XG4gICAgICAgICAgZS52YWx1ZSA9PT0gbnVsbFxuICAgICAgICAgICAgPyBEZWNvcmF0aW9uLm5vbmVcbiAgICAgICAgICAgIDogRGVjb3JhdGlvbi5zZXQoZHJvcHBpbmdMaW5lRGVjb3JhdGlvbi5yYW5nZShlLnZhbHVlLCBlLnZhbHVlKSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChlLmlzKGRuZEVuZGVkKSkge1xuICAgICAgICBkbmREcm9wcGluZ1N0YXRlID0gRGVjb3JhdGlvbi5ub25lO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBkbmREcm9wcGluZ1N0YXRlO1xuICB9LFxuXG4gIHByb3ZpZGU6IChmKSA9PiBFZGl0b3JWaWV3LmRlY29yYXRpb25zLmZyb20oZiksXG59KTtcblxuZnVuY3Rpb24gZ2V0RWRpdG9yVmlld0Zyb21IVE1MRWxlbWVudChlOiBIVE1MRWxlbWVudCkge1xuICB3aGlsZSAoZSAmJiAhZS5jbGFzc0xpc3QuY29udGFpbnMoXCJjbS1lZGl0b3JcIikpIHtcbiAgICBlID0gZS5wYXJlbnRFbGVtZW50O1xuICB9XG5cbiAgaWYgKCFlKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gRWRpdG9yVmlldy5maW5kRnJvbURPTShlKTtcbn1cblxuZnVuY3Rpb24gaXNDbGlja09uQnVsbGV0KGU6IE1vdXNlRXZlbnQpIHtcbiAgbGV0IGVsID0gZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQ7XG5cbiAgd2hpbGUgKGVsKSB7XG4gICAgaWYgKFxuICAgICAgZWwuY2xhc3NMaXN0LmNvbnRhaW5zKFwiY20tZm9ybWF0dGluZy1saXN0XCIpIHx8XG4gICAgICBlbC5jbGFzc0xpc3QuY29udGFpbnMoXCJjbS1mb2xkLWluZGljYXRvclwiKSB8fFxuICAgICAgZWwuY2xhc3NMaXN0LmNvbnRhaW5zKFwidGFzay1saXN0LWl0ZW0tY2hlY2tib3hcIikgfHxcbiAgICAgIGVsLmhhc0F0dHJpYnV0ZShcImRhdGEtb3V0bGluZXItZHJhZy1oYW5kbGVcIilcbiAgICApIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGVsID0gZWwucGFyZW50RWxlbWVudDtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZ2V0RXZlbnREb2N1bWVudChlOiBFdmVudCkge1xuICBjb25zdCB0YXJnZXQgPSBlLnRhcmdldDtcbiAgaWYgKCF0YXJnZXQgfHwgdHlwZW9mIHRhcmdldCAhPT0gXCJvYmplY3RcIikge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgY29uc3QgbWF5YmVOb2RlID0gdGFyZ2V0IGFzIHtcbiAgICBub2RlVHlwZT86IG51bWJlcjtcbiAgICBvd25lckRvY3VtZW50PzogRG9jdW1lbnQgfCBudWxsO1xuICB9O1xuICBpZiAobWF5YmVOb2RlLm5vZGVUeXBlID09PSA5KSB7XG4gICAgcmV0dXJuIHRhcmdldCBhcyBEb2N1bWVudDtcbiAgfVxuICBpZiAoXCJvd25lckRvY3VtZW50XCIgaW4gbWF5YmVOb2RlKSB7XG4gICAgcmV0dXJuIG1heWJlTm9kZS5vd25lckRvY3VtZW50IHx8IG51bGw7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzU2FtZVJvb3RzKGE6IFJvb3QsIGI6IFJvb3QpIHtcbiAgY29uc3QgW2FTdGFydCwgYUVuZF0gPSBhLmdldENvbnRlbnRSYW5nZSgpO1xuICBjb25zdCBbYlN0YXJ0LCBiRW5kXSA9IGIuZ2V0Q29udGVudFJhbmdlKCk7XG5cbiAgaWYgKGNtcFBvcyhhU3RhcnQsIGJTdGFydCkgIT09IDAgfHwgY21wUG9zKGFFbmQsIGJFbmQpICE9PSAwKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIGEucHJpbnQoKSA9PT0gYi5wcmludCgpO1xufVxuXG5mdW5jdGlvbiBpc0ZlYXR1cmVTdXBwb3J0ZWQoKSB7XG4gIHJldHVybiBQbGF0Zm9ybS5pc0Rlc2t0b3A7XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgUm9vdCwgY21wUG9zLCBtYXhQb3MsIG1pblBvcyB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBFeHBhbmRTZWxlY3Rpb25Ub0Z1bGxJdGVtcyBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgdXBkYXRlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdDogUm9vdCkge31cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlZDtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICB0aGlzLnVwZGF0ZWQgPSBmYWxzZTtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG4gICAgaWYgKCFyb290Lmhhc1NpbmdsZVNlbGVjdGlvbigpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgeyBhbmNob3IsIGhlYWQgfSA9IHJvb3QuZ2V0U2VsZWN0aW9uKCk7XG4gICAgY29uc3QgZnJvbSA9IG1pblBvcyhhbmNob3IsIGhlYWQpO1xuICAgIGNvbnN0IHRvID0gbWF4UG9zKGFuY2hvciwgaGVhZCk7XG4gICAgY29uc3QgW3Jvb3RTdGFydCwgcm9vdEVuZF0gPSByb290LmdldENvbnRlbnRSYW5nZSgpO1xuICAgIGlmIChjbXBQb3MoZnJvbSwgcm9vdFN0YXJ0KSA8IDAgfHwgY21wUG9zKHRvLCByb290RW5kKSA+IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBTZWxlY3Rpb24gcmFuZ2VzIGFyZSBoYWxmLW9wZW46IGNvbHVtbiB6ZXJvIGRvZXMgbm90IHNlbGVjdCB0aGF0IGl0ZW0uXG4gICAgY29uc3QgbGFzdFNlbGVjdGVkTGluZSA9IHRvLmNoID09PSAwID8gdG8ubGluZSAtIDEgOiB0by5saW5lO1xuICAgIGlmIChsYXN0U2VsZWN0ZWRMaW5lIDw9IGZyb20ubGluZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGZpcnN0ID0gcm9vdC5nZXRMaXN0VW5kZXJMaW5lKGZyb20ubGluZSk7XG4gICAgY29uc3QgbGFzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyTGluZShsYXN0U2VsZWN0ZWRMaW5lKTtcbiAgICBpZiAoIWZpcnN0IHx8ICFsYXN0IHx8IGZpcnN0ID09PSBsYXN0KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZXhwYW5kZWRTdGFydCA9IG1pblBvcyhcbiAgICAgIGZyb20sXG4gICAgICBmaXJzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnRBZnRlckNoZWNrYm94KCksXG4gICAgKTtcbiAgICBsZXQgZXhwYW5kZWRFbmQgPSBtYXhQb3ModG8sIGZpcnN0LmdldENvbnRlbnRFbmRJbmNsdWRpbmdDaGlsZHJlbigpKTtcblxuICAgIC8vIEFueSBpbnRlcnZlbmluZyBpdGVtIHdob3NlIHN1YnRyZWUgZXh0ZW5kcyBwYXN0IHRoZSBsYXN0IHNlbGVjdGVkIGl0ZW1cbiAgICAvLyBtdXN0IGJlIGl0cyBhbmNlc3Rvci4gSW5jbHVkZSBpdCBvbmx5IGlmIGl0cyBvd24gY29udGVudCB3YXMgdG91Y2hlZC5cbiAgICBmb3IgKFxuICAgICAgbGV0IGl0ZW0gPSBsYXN0O1xuICAgICAgaXRlbSAmJiBpdGVtICE9PSByb290LmdldFJvb3RMaXN0KCk7XG4gICAgICBpdGVtID0gaXRlbS5nZXRQYXJlbnQoKVxuICAgICkge1xuICAgICAgaWYgKGl0ZW0uZ2V0TGFzdExpbmVDb250ZW50RW5kKCkubGluZSA8IGZyb20ubGluZSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGV4cGFuZGVkRW5kID0gbWF4UG9zKGV4cGFuZGVkRW5kLCBpdGVtLmdldENvbnRlbnRFbmRJbmNsdWRpbmdDaGlsZHJlbigpKTtcbiAgICB9XG5cbiAgICBpZiAoY21wUG9zKGZyb20sIGV4cGFuZGVkU3RhcnQpID09PSAwICYmIGNtcFBvcyh0bywgZXhwYW5kZWRFbmQpID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZm9yd2FyZCA9IGNtcFBvcyhhbmNob3IsIGhlYWQpIDw9IDA7XG4gICAgcm9vdC5yZXBsYWNlU2VsZWN0aW9ucyhbXG4gICAgICBmb3J3YXJkXG4gICAgICAgID8geyBhbmNob3I6IGV4cGFuZGVkU3RhcnQsIGhlYWQ6IGV4cGFuZGVkRW5kIH1cbiAgICAgICAgOiB7IGFuY2hvcjogZXhwYW5kZWRFbmQsIGhlYWQ6IGV4cGFuZGVkU3RhcnQgfSxcbiAgICBdKTtcbiAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuICB9XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgUm9vdCB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBLZWVwQ3Vyc29yT3V0c2lkZUZvbGRlZExpbmVzIGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByb290OiBSb290KSB7fVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdG9wUHJvcGFnYXRpb247XG4gIH1cblxuICBzaG91bGRVcGRhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlZDtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgeyByb290IH0gPSB0aGlzO1xuXG4gICAgaWYgKCFyb290Lmhhc1NpbmdsZUN1cnNvcigpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcblxuICAgIGNvbnN0IGxpc3QgPSByb290LmdldExpc3RVbmRlckN1cnNvcigpO1xuICAgIGlmICghbGlzdC5pc0ZvbGRlZCgpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZm9sZFJvb3QgPSBsaXN0LmdldFRvcEZvbGRSb290KCk7XG4gICAgY29uc3QgZmlyc3RMaW5lRW5kID0gZm9sZFJvb3QuZ2V0TGluZXNJbmZvKClbMF0udG87XG5cbiAgICBpZiAoY3Vyc29yLmxpbmUgPiBmaXJzdExpbmVFbmQubGluZSkge1xuICAgICAgdGhpcy51cGRhdGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcbiAgICAgIHJvb3QucmVwbGFjZUN1cnNvcihmaXJzdExpbmVFbmQpO1xuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4vT3BlcmF0aW9uXCI7XG5cbmltcG9ydCB7IFJvb3QgfSBmcm9tIFwiLi4vcm9vdFwiO1xuXG5leHBvcnQgY2xhc3MgS2VlcEN1cnNvcldpdGhpbkxpc3RDb250ZW50IGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByb290OiBSb290KSB7fVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdG9wUHJvcGFnYXRpb247XG4gIH1cblxuICBzaG91bGRVcGRhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlZDtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgeyByb290IH0gPSB0aGlzO1xuXG4gICAgaWYgKCFyb290Lmhhc1NpbmdsZUN1cnNvcigpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJDdXJzb3IoKTtcbiAgICBjb25zdCBjb250ZW50U3RhcnQgPSBsaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydEFmdGVyQ2hlY2tib3goKTtcbiAgICBjb25zdCBsaW5lUHJlZml4ID1cbiAgICAgIGNvbnRlbnRTdGFydC5saW5lID09PSBjdXJzb3IubGluZVxuICAgICAgICA/IGNvbnRlbnRTdGFydC5jaFxuICAgICAgICA6IGxpc3QuZ2V0Tm90ZXNJbmRlbnQoKS5sZW5ndGg7XG5cbiAgICBpZiAoY3Vyc29yLmNoIDwgbGluZVByZWZpeCkge1xuICAgICAgdGhpcy51cGRhdGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcbiAgICAgIHJvb3QucmVwbGFjZUN1cnNvcih7XG4gICAgICAgIGxpbmU6IGN1cnNvci5saW5lLFxuICAgICAgICBjaDogbGluZVByZWZpeCxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IEVkaXRvclN0YXRlLCBUcmFuc2FjdGlvbiB9IGZyb20gXCJAY29kZW1pcnJvci9zdGF0ZVwiO1xuXG5pbXBvcnQgeyBGZWF0dXJlIH0gZnJvbSBcIi4vRmVhdHVyZVwiO1xuXG5pbXBvcnQgeyBNeUVkaXRvciwgZ2V0RWRpdG9yRnJvbVN0YXRlIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgRXhwYW5kU2VsZWN0aW9uVG9GdWxsSXRlbXMgfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9FeHBhbmRTZWxlY3Rpb25Ub0Z1bGxJdGVtc1wiO1xuaW1wb3J0IHsgS2VlcEN1cnNvck91dHNpZGVGb2xkZWRMaW5lcyB9IGZyb20gXCIuLi9vcGVyYXRpb25zL0tlZXBDdXJzb3JPdXRzaWRlRm9sZGVkTGluZXNcIjtcbmltcG9ydCB7IEtlZXBDdXJzb3JXaXRoaW5MaXN0Q29udGVudCB9IGZyb20gXCIuLi9vcGVyYXRpb25zL0tlZXBDdXJzb3JXaXRoaW5MaXN0Q29udGVudFwiO1xuaW1wb3J0IHsgT3BlcmF0aW9uUGVyZm9ybWVyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09wZXJhdGlvblBlcmZvcm1lclwiO1xuaW1wb3J0IHsgUGFyc2VyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1BhcnNlclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcblxuZXhwb3J0IGNsYXNzIEVkaXRvclNlbGVjdGlvbnNCZWhhdmlvdXJPdmVycmlkZSBpbXBsZW1lbnRzIEZlYXR1cmUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICAgIHByaXZhdGUgcGFyc2VyOiBQYXJzZXIsXG4gICAgcHJpdmF0ZSBvcGVyYXRpb25QZXJmb3JtZXI6IE9wZXJhdGlvblBlcmZvcm1lcixcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFZGl0b3JFeHRlbnNpb24oXG4gICAgICBFZGl0b3JTdGF0ZS50cmFuc2FjdGlvbkV4dGVuZGVyLm9mKHRoaXMudHJhbnNhY3Rpb25FeHRlbmRlciksXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHt9XG5cbiAgcHJpdmF0ZSB0cmFuc2FjdGlvbkV4dGVuZGVyID0gKHRyOiBUcmFuc2FjdGlvbik6IG51bGwgPT4ge1xuICAgIGlmIChcbiAgICAgICF0ci5zZWxlY3Rpb24gfHxcbiAgICAgICghdGhpcy5zZXR0aW5ncy5leHBhbmRTZWxlY3Rpb24gJiZcbiAgICAgICAgdGhpcy5zZXR0aW5ncy5rZWVwQ3Vyc29yV2l0aGluQ29udGVudCA9PT0gXCJuZXZlclwiKVxuICAgICkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgZWRpdG9yID0gZ2V0RWRpdG9yRnJvbVN0YXRlKHRyLnN0YXJ0U3RhdGUpO1xuXG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLmhhbmRsZVNlbGVjdGlvbnNDaGFuZ2VzKGVkaXRvcik7XG4gICAgfSwgMCk7XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfTtcblxuICBwcml2YXRlIGhhbmRsZVNlbGVjdGlvbnNDaGFuZ2VzID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICBjb25zdCByb290ID0gdGhpcy5wYXJzZXIucGFyc2UoZWRpdG9yKTtcblxuICAgIGlmICghcm9vdCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnNldHRpbmdzLmV4cGFuZFNlbGVjdGlvbikge1xuICAgICAgY29uc3QgeyBzaG91bGRTdG9wUHJvcGFnYXRpb24gfSA9IHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLmV2YWwoXG4gICAgICAgIHJvb3QsXG4gICAgICAgIG5ldyBFeHBhbmRTZWxlY3Rpb25Ub0Z1bGxJdGVtcyhyb290KSxcbiAgICAgICAgZWRpdG9yLFxuICAgICAgKTtcblxuICAgICAgaWYgKHNob3VsZFN0b3BQcm9wYWdhdGlvbikge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc2V0dGluZ3Mua2VlcEN1cnNvcldpdGhpbkNvbnRlbnQgPT09IFwibmV2ZXJcIikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHtcbiAgICAgIGNvbnN0IHsgc2hvdWxkU3RvcFByb3BhZ2F0aW9uIH0gPSB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5ldmFsKFxuICAgICAgICByb290LFxuICAgICAgICBuZXcgS2VlcEN1cnNvck91dHNpZGVGb2xkZWRMaW5lcyhyb290KSxcbiAgICAgICAgZWRpdG9yLFxuICAgICAgKTtcblxuICAgICAgaWYgKHNob3VsZFN0b3BQcm9wYWdhdGlvbikge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIuZXZhbChcbiAgICAgIHJvb3QsXG4gICAgICBuZXcgS2VlcEN1cnNvcldpdGhpbkxpc3RDb250ZW50KHJvb3QpLFxuICAgICAgZWRpdG9yLFxuICAgICk7XG4gIH07XG59XG4iLCJleHBvcnQgY29uc3QgY2hlY2tib3hSZSA9IGBcXFxcW1teXFxcXFtcXFxcXV1cXFxcXVsgXFx0XWA7XG4iLCJleHBvcnQgZnVuY3Rpb24gaXNFbXB0eUxpbmVPckVtcHR5Q2hlY2tib3gobGluZTogc3RyaW5nKSB7XG4gIHJldHVybiBsaW5lID09PSBcIlwiIHx8IGxpbmUgPT09IFwiWyBdIFwiO1xufVxuIiwiaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4vT3BlcmF0aW9uXCI7XG5cbmltcG9ydCB7IExpc3QsIFBvc2l0aW9uLCBSb290LCByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzIH0gZnJvbSBcIi4uL3Jvb3RcIjtcbmltcG9ydCB7IGNoZWNrYm94UmUgfSBmcm9tIFwiLi4vdXRpbHMvY2hlY2tib3hSZVwiO1xuaW1wb3J0IHsgaXNFbXB0eUxpbmVPckVtcHR5Q2hlY2tib3ggfSBmcm9tIFwiLi4vdXRpbHMvaXNFbXB0eUxpbmVPckVtcHR5Q2hlY2tib3hcIjtcblxuZXhwb3J0IGludGVyZmFjZSBHZXRab29tUmFuZ2Uge1xuICBnZXRab29tUmFuZ2UoKTogeyBmcm9tOiBQb3NpdGlvbjsgdG86IFBvc2l0aW9uIH0gfCBudWxsO1xufVxuXG5leHBvcnQgY2xhc3MgQ3JlYXRlTmV3SXRlbSBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gIHByaXZhdGUgdXBkYXRlZCA9IGZhbHNlO1xuICBwcml2YXRlIHNraXBwZWRJbnNpZGVDb2RlYmxvY2sgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJvb3Q6IFJvb3QsXG4gICAgcHJpdmF0ZSBkZWZhdWx0SW5kZW50Q2hhcnM6IHN0cmluZyxcbiAgICBwcml2YXRlIGdldFpvb21SYW5nZTogR2V0Wm9vbVJhbmdlLFxuICAgIHByaXZhdGUgYWZ0ZXI6IGJvb2xlYW4gPSB0cnVlLFxuICAgIHByaXZhdGUgc2hvdWxkT3V0ZGVudEVtcHR5TGluZXM6IGJvb2xlYW4gPSB0cnVlLFxuICApIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgd2FzU2tpcHBlZEluc2lkZUNvZGVibG9jaygpIHtcbiAgICByZXR1cm4gdGhpcy5za2lwcGVkSW5zaWRlQ29kZWJsb2NrO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlU2VsZWN0aW9uKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBzZWxlY3Rpb24gPSByb290LmdldFNlbGVjdGlvbigpO1xuICAgIGlmICghc2VsZWN0aW9uIHx8IHNlbGVjdGlvbi5hbmNob3IubGluZSAhPT0gc2VsZWN0aW9uLmhlYWQubGluZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxpc3QgPSByb290LmdldExpc3RVbmRlckN1cnNvcigpO1xuICAgIGNvbnN0IGxpbmVzID0gbGlzdC5nZXRMaW5lc0luZm8oKTtcblxuICAgIC8vIE9ubHkgc2tpcCBjcmVhdGlvbiBvZiBuZXcgaXRlbXMgZm9yIGVtcHR5IGxpbmVzIGlmIG91dGRlbnRpbmcgaXMgZW5hYmxlZFxuICAgIC8vIFdoZW4gb3V0ZGVudGluZyBpcyBkaXNhYmxlZCwgd2Ugd2FudCB0byBjcmVhdGUgbmV3IGl0ZW1zIGZvciBlbXB0eSBsaW5lc1xuICAgIGlmIChcbiAgICAgIGxpbmVzLmxlbmd0aCA9PT0gMSAmJlxuICAgICAgaXNFbXB0eUxpbmVPckVtcHR5Q2hlY2tib3gobGluZXNbMF0udGV4dCkgJiZcbiAgICAgIHRoaXMuc2hvdWxkT3V0ZGVudEVtcHR5TGluZXNcbiAgICApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjdXJzb3IgPSByb290LmdldEN1cnNvcigpO1xuICAgIGNvbnN0IGxpbmVVbmRlckN1cnNvciA9IGxpbmVzLmZpbmQoKGwpID0+IGwuZnJvbS5saW5lID09PSBjdXJzb3IubGluZSk7XG5cbiAgICBpZiAoY3Vyc29yLmNoIDwgbGluZVVuZGVyQ3Vyc29yLmZyb20uY2gpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB7IG9sZExpbmVzLCBuZXdMaW5lcyB9ID0gbGluZXMucmVkdWNlKFxuICAgICAgKGFjYywgbGluZSkgPT4ge1xuICAgICAgICBpZiAoY3Vyc29yLmxpbmUgPiBsaW5lLmZyb20ubGluZSkge1xuICAgICAgICAgIGFjYy5vbGRMaW5lcy5wdXNoKGxpbmUudGV4dCk7XG4gICAgICAgIH0gZWxzZSBpZiAoY3Vyc29yLmxpbmUgPT09IGxpbmUuZnJvbS5saW5lKSB7XG4gICAgICAgICAgY29uc3QgbGVmdCA9IGxpbmUudGV4dC5zbGljZSgwLCBzZWxlY3Rpb24uZnJvbSAtIGxpbmUuZnJvbS5jaCk7XG4gICAgICAgICAgY29uc3QgcmlnaHQgPSBsaW5lLnRleHQuc2xpY2Uoc2VsZWN0aW9uLnRvIC0gbGluZS5mcm9tLmNoKTtcbiAgICAgICAgICBhY2Mub2xkTGluZXMucHVzaChsZWZ0KTtcbiAgICAgICAgICBhY2MubmV3TGluZXMucHVzaChyaWdodCk7XG4gICAgICAgIH0gZWxzZSBpZiAoY3Vyc29yLmxpbmUgPCBsaW5lLmZyb20ubGluZSkge1xuICAgICAgICAgIGFjYy5uZXdMaW5lcy5wdXNoKGxpbmUudGV4dCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgb2xkTGluZXM6IFtdLFxuICAgICAgICBuZXdMaW5lczogW10sXG4gICAgICB9LFxuICAgICk7XG5cbiAgICBjb25zdCBjb2RlQmxvY2tCYWN0aWNrcyA9IG9sZExpbmVzLmpvaW4oXCJcXG5cIikuc3BsaXQoXCJgYGBcIikubGVuZ3RoIC0gMTtcbiAgICBjb25zdCBpc0luc2lkZUNvZGVibG9jayA9XG4gICAgICBjb2RlQmxvY2tCYWN0aWNrcyA+IDAgJiYgY29kZUJsb2NrQmFjdGlja3MgJSAyICE9PSAwO1xuXG4gICAgaWYgKGlzSW5zaWRlQ29kZWJsb2NrKSB7XG4gICAgICB0aGlzLnNraXBwZWRJbnNpZGVDb2RlYmxvY2sgPSB0cnVlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcbiAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgY29uc3Qgem9vbVJhbmdlID0gdGhpcy5nZXRab29tUmFuZ2UuZ2V0Wm9vbVJhbmdlKCk7XG4gICAgY29uc3QgbGlzdElzWm9vbWluZ1Jvb3QgPSBCb29sZWFuKFxuICAgICAgem9vbVJhbmdlICYmXG4gICAgICBsaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUgPj0gem9vbVJhbmdlLmZyb20ubGluZSAmJlxuICAgICAgbGlzdC5nZXRMYXN0TGluZUNvbnRlbnRFbmQoKS5saW5lIDw9IHpvb21SYW5nZS5mcm9tLmxpbmUsXG4gICAgKTtcblxuICAgIGNvbnN0IGhhc0NoaWxkcmVuID0gIWxpc3QuaXNFbXB0eSgpO1xuICAgIGNvbnN0IGNoaWxkSXNGb2xkZWQgPSBsaXN0LmlzRm9sZFJvb3QoKTtcbiAgICBjb25zdCBlbmRQb3MgPSBsaXN0LmdldExhc3RMaW5lQ29udGVudEVuZCgpO1xuICAgIGNvbnN0IGVuZE9mTGluZSA9IGN1cnNvci5saW5lID09PSBlbmRQb3MubGluZSAmJiBjdXJzb3IuY2ggPT09IGVuZFBvcy5jaDtcblxuICAgIGNvbnN0IG9uQ2hpbGRMZXZlbCA9XG4gICAgICB0aGlzLmFmdGVyICYmXG4gICAgICAobGlzdElzWm9vbWluZ1Jvb3QgfHwgKGhhc0NoaWxkcmVuICYmICFjaGlsZElzRm9sZGVkICYmIGVuZE9mTGluZSkpO1xuXG4gICAgY29uc3QgaW5kZW50ID0gb25DaGlsZExldmVsXG4gICAgICA/IGhhc0NoaWxkcmVuXG4gICAgICAgID8gbGlzdC5nZXRDaGlsZHJlbigpWzBdLmdldEZpcnN0TGluZUluZGVudCgpXG4gICAgICAgIDogbGlzdC5nZXRGaXJzdExpbmVJbmRlbnQoKSArIHRoaXMuZGVmYXVsdEluZGVudENoYXJzXG4gICAgICA6IGxpc3QuZ2V0Rmlyc3RMaW5lSW5kZW50KCk7XG5cbiAgICBjb25zdCBidWxsZXQgPVxuICAgICAgb25DaGlsZExldmVsICYmIGhhc0NoaWxkcmVuXG4gICAgICAgID8gbGlzdC5nZXRDaGlsZHJlbigpWzBdLmdldEJ1bGxldCgpXG4gICAgICAgIDogbGlzdC5nZXRCdWxsZXQoKTtcblxuICAgIGNvbnN0IHNwYWNlQWZ0ZXJCdWxsZXQgPVxuICAgICAgb25DaGlsZExldmVsICYmIGhhc0NoaWxkcmVuXG4gICAgICAgID8gbGlzdC5nZXRDaGlsZHJlbigpWzBdLmdldFNwYWNlQWZ0ZXJCdWxsZXQoKVxuICAgICAgICA6IGxpc3QuZ2V0U3BhY2VBZnRlckJ1bGxldCgpO1xuXG4gICAgY29uc3QgcHJlZml4ID0gb2xkTGluZXNbMF0ubWF0Y2goY2hlY2tib3hSZSkgPyBcIlsgXSBcIiA6IFwiXCI7XG5cbiAgICBjb25zdCBuZXdMaXN0ID0gbmV3IExpc3QoXG4gICAgICBsaXN0LmdldFJvb3QoKSxcbiAgICAgIGluZGVudCxcbiAgICAgIGJ1bGxldCxcbiAgICAgIHByZWZpeCxcbiAgICAgIHNwYWNlQWZ0ZXJCdWxsZXQsXG4gICAgICBwcmVmaXggKyBuZXdMaW5lcy5zaGlmdCgpLFxuICAgICAgZmFsc2UsXG4gICAgKTtcblxuICAgIGlmIChuZXdMaW5lcy5sZW5ndGggPiAwKSB7XG4gICAgICBuZXdMaXN0LnNldE5vdGVzSW5kZW50KGxpc3QuZ2V0Tm90ZXNJbmRlbnQoKSk7XG4gICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbmV3TGluZXMpIHtcbiAgICAgICAgbmV3TGlzdC5hZGRMaW5lKGxpbmUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChvbkNoaWxkTGV2ZWwpIHtcbiAgICAgIGxpc3QuYWRkQmVmb3JlQWxsKG5ld0xpc3QpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodGhpcy5hZnRlciAmJiAoIWNoaWxkSXNGb2xkZWQgfHwgIWVuZE9mTGluZSkpIHtcbiAgICAgICAgY29uc3QgY2hpbGRyZW4gPSBsaXN0LmdldENoaWxkcmVuKCk7XG4gICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgY2hpbGRyZW4pIHtcbiAgICAgICAgICBsaXN0LnJlbW92ZUNoaWxkKGNoaWxkKTtcbiAgICAgICAgICBuZXdMaXN0LmFkZEFmdGVyQWxsKGNoaWxkKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5hZnRlcikge1xuICAgICAgICBsaXN0LmdldFBhcmVudCgpLmFkZEFmdGVyKGxpc3QsIG5ld0xpc3QpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGlzdC5nZXRQYXJlbnQoKS5hZGRCZWZvcmUobGlzdCwgbmV3TGlzdCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGlzdC5yZXBsYWNlTGluZXMob2xkTGluZXMpO1xuXG4gICAgY29uc3QgbmV3TGlzdFN0YXJ0ID0gbmV3TGlzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKTtcbiAgICByb290LnJlcGxhY2VDdXJzb3Ioe1xuICAgICAgbGluZTogbmV3TGlzdFN0YXJ0LmxpbmUsXG4gICAgICBjaDogbmV3TGlzdFN0YXJ0LmNoICsgcHJlZml4Lmxlbmd0aCxcbiAgICB9KTtcblxuICAgIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMocm9vdCk7XG4gIH1cbn1cbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBSb290LCByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzIH0gZnJvbSBcIi4uL3Jvb3RcIjtcblxuZXhwb3J0IGNsYXNzIE91dGRlbnRMaXN0IGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByb290OiBSb290KSB7fVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdG9wUHJvcGFnYXRpb247XG4gIH1cblxuICBzaG91bGRVcGRhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlZDtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgeyByb290IH0gPSB0aGlzO1xuXG4gICAgaWYgKCFyb290Lmhhc1NpbmdsZUN1cnNvcigpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuXG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgY29uc3QgcGFyZW50ID0gbGlzdC5nZXRQYXJlbnQoKTtcbiAgICBjb25zdCBncmFuZFBhcmVudCA9IHBhcmVudC5nZXRQYXJlbnQoKTtcblxuICAgIGlmICghZ3JhbmRQYXJlbnQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgY29uc3QgbGlzdFN0YXJ0TGluZUJlZm9yZSA9IHJvb3QuZ2V0Q29udGVudExpbmVzUmFuZ2VPZihsaXN0KVswXTtcbiAgICBjb25zdCBpbmRlbnRSbUZyb20gPSBwYXJlbnQuZ2V0Rmlyc3RMaW5lSW5kZW50KCkubGVuZ3RoO1xuICAgIGNvbnN0IGluZGVudFJtVGlsbCA9IGxpc3QuZ2V0Rmlyc3RMaW5lSW5kZW50KCkubGVuZ3RoO1xuXG4gICAgcGFyZW50LnJlbW92ZUNoaWxkKGxpc3QpO1xuICAgIGdyYW5kUGFyZW50LmFkZEFmdGVyKHBhcmVudCwgbGlzdCk7XG4gICAgbGlzdC51bmluZGVudENvbnRlbnQoaW5kZW50Um1Gcm9tLCBpbmRlbnRSbVRpbGwpO1xuXG4gICAgY29uc3QgbGlzdFN0YXJ0TGluZUFmdGVyID0gcm9vdC5nZXRDb250ZW50TGluZXNSYW5nZU9mKGxpc3QpWzBdO1xuICAgIGNvbnN0IGxpbmVEaWZmID0gbGlzdFN0YXJ0TGluZUFmdGVyIC0gbGlzdFN0YXJ0TGluZUJlZm9yZTtcbiAgICBjb25zdCBjaERpZmYgPSBpbmRlbnRSbVRpbGwgLSBpbmRlbnRSbUZyb207XG5cbiAgICBjb25zdCBjdXJzb3IgPSByb290LmdldEN1cnNvcigpO1xuICAgIHJvb3QucmVwbGFjZUN1cnNvcih7XG4gICAgICBsaW5lOiBjdXJzb3IubGluZSArIGxpbmVEaWZmLFxuICAgICAgY2g6IGN1cnNvci5jaCAtIGNoRGlmZixcbiAgICB9KTtcblxuICAgIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMocm9vdCk7XG4gIH1cbn1cbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuaW1wb3J0IHsgT3V0ZGVudExpc3QgfSBmcm9tIFwiLi9PdXRkZW50TGlzdFwiO1xuXG5pbXBvcnQgeyBMaXN0LCBSb290IH0gZnJvbSBcIi4uL3Jvb3RcIjtcbmltcG9ydCB7IGlzRW1wdHlMaW5lT3JFbXB0eUNoZWNrYm94IH0gZnJvbSBcIi4uL3V0aWxzL2lzRW1wdHlMaW5lT3JFbXB0eUNoZWNrYm94XCI7XG5cbmV4cG9ydCBjbGFzcyBPdXRkZW50TGlzdElmSXRzRW1wdHkgaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIG91dGRlbnRMaXN0OiBPdXRkZW50TGlzdDtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByb290OiBSb290KSB7XG4gICAgdGhpcy5vdXRkZW50TGlzdCA9IG5ldyBPdXRkZW50TGlzdChyb290KTtcbiAgfVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdG9wUHJvcGFnYXRpb24gfHwgdGhpcy5vdXRkZW50TGlzdC5zaG91bGRTdG9wUHJvcGFnYXRpb24oKTtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkIHx8IHRoaXMub3V0ZGVudExpc3Quc2hvdWxkVXBkYXRlKCk7XG4gIH1cblxuICBwZXJmb3JtKCkge1xuICAgIGNvbnN0IHsgcm9vdCB9ID0gdGhpcztcblxuICAgIGlmICghcm9vdC5oYXNTaW5nbGVDdXJzb3IoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxpc3QgPSByb290LmdldExpc3RVbmRlckN1cnNvcigpO1xuICAgIGNvbnN0IGxpbmVzID0gbGlzdC5nZXRMaW5lcygpO1xuXG4gICAgaWYgKGxpbmVzLmxlbmd0aCA+IDEgfHwgIWlzRW1wdHlMaW5lT3JFbXB0eUNoZWNrYm94KGxpbmVzWzBdKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChsaXN0LmdldExldmVsKCkgPT09IDEpIHtcbiAgICAgIHRoaXMuZGVsZXRlTGlzdElmSXRJc1RoZUxhc3RBbmRIYXNOb0NoaWxkcmVuKGxpc3QpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMub3V0ZGVudExpc3QucGVyZm9ybSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBkZWxldGVMaXN0SWZJdElzVGhlTGFzdEFuZEhhc05vQ2hpbGRyZW4obGlzdDogTGlzdCkge1xuICAgIGNvbnN0IHsgcm9vdCB9ID0gdGhpcztcbiAgICBjb25zdCBwYXJlbnQgPSBsaXN0LmdldFBhcmVudCgpO1xuICAgIGNvbnN0IHNpYmxpbmdzID0gcGFyZW50LmdldENoaWxkcmVuKCk7XG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcblxuICAgIGlmIChcbiAgICAgICFsaXN0LmlzRW1wdHkoKSB8fFxuICAgICAgc2libGluZ3Nbc2libGluZ3MubGVuZ3RoIC0gMV0gIT09IGxpc3QgfHxcbiAgICAgIGN1cnNvci5jaCAhPT0gbGlzdC5nZXRMYXN0TGluZUNvbnRlbnRFbmQoKS5jaFxuICAgICkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcbiAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgcGFyZW50LnJlbW92ZUNoaWxkKGxpc3QpO1xuICAgIC8vIENsb3NpbmcgdGhlIGxpc3QgbGVhdmVzIGFuIGVtcHR5IGxpbmUgYmVoaW5kLiBSb290LnByaW50KCkgc3RyaXBzXG4gICAgLy8gYSBzaW5nbGUgdHJhaWxpbmcgbmV3bGluZSwgc28gYW4gZW1wdHkgbGlzdCBpdGVtIGlzIG5lZWRlZCB0b1xuICAgIC8vIHJlcHJlc2VudCB0aGF0IHJlbWFpbmluZyBlbXB0eSBsaW5lIGluIHRoZSBtb2RlbC5cbiAgICBwYXJlbnQuYWRkQWZ0ZXJBbGwobmV3IExpc3Qocm9vdCwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgZmFsc2UpKTtcblxuICAgIHJvb3QucmVwbGFjZUN1cnNvcih7IGxpbmU6IGN1cnNvci5saW5lLCBjaDogMCB9KTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IFByZWMgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivc3RhdGVcIjtcbmltcG9ydCB7IGtleW1hcCB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgQ3JlYXRlTmV3SXRlbSB9IGZyb20gXCIuLi9vcGVyYXRpb25zL0NyZWF0ZU5ld0l0ZW1cIjtcbmltcG9ydCB7IE91dGRlbnRMaXN0SWZJdHNFbXB0eSB9IGZyb20gXCIuLi9vcGVyYXRpb25zL091dGRlbnRMaXN0SWZJdHNFbXB0eVwiO1xuaW1wb3J0IHsgSU1FRGV0ZWN0b3IgfSBmcm9tIFwiLi4vc2VydmljZXMvSU1FRGV0ZWN0b3JcIjtcbmltcG9ydCB7IE9ic2lkaWFuU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvT2JzaWRpYW5TZXR0aW5nc1wiO1xuaW1wb3J0IHsgT3BlcmF0aW9uUGVyZm9ybWVyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09wZXJhdGlvblBlcmZvcm1lclwiO1xuaW1wb3J0IHsgUGFyc2VyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1BhcnNlclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcbmltcG9ydCB7IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrIH0gZnJvbSBcIi4uL3V0aWxzL2NyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrXCI7XG5cbmV4cG9ydCBjbGFzcyBFbnRlckJlaGF2aW91ck92ZXJyaWRlIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBpbWVEZXRlY3RvcjogSU1FRGV0ZWN0b3IsXG4gICAgcHJpdmF0ZSBvYnNpZGlhblNldHRpbmdzOiBPYnNpZGlhblNldHRpbmdzLFxuICAgIHByaXZhdGUgcGFyc2VyOiBQYXJzZXIsXG4gICAgcHJpdmF0ZSBvcGVyYXRpb25QZXJmb3JtZXI6IE9wZXJhdGlvblBlcmZvcm1lcixcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFZGl0b3JFeHRlbnNpb24oXG4gICAgICBQcmVjLmhpZ2hlc3QoXG4gICAgICAgIGtleW1hcC5vZihbXG4gICAgICAgICAge1xuICAgICAgICAgICAga2V5OiBcIkVudGVyXCIsXG4gICAgICAgICAgICBydW46IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKHtcbiAgICAgICAgICAgICAgY2hlY2s6IHRoaXMuY2hlY2ssXG4gICAgICAgICAgICAgIHJ1bjogdGhpcy5ydW4sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICB9LFxuICAgICAgICBdKSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHt9XG5cbiAgcHJpdmF0ZSBjaGVjayA9ICgpID0+IHtcbiAgICByZXR1cm4gdGhpcy5zZXR0aW5ncy5vdmVycmlkZUVudGVyQmVoYXZpb3VyICYmICF0aGlzLmltZURldGVjdG9yLmlzT3BlbmVkKCk7XG4gIH07XG5cbiAgcHJpdmF0ZSBydW4gPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIGNvbnN0IHJvb3QgPSB0aGlzLnBhcnNlci5wYXJzZShlZGl0b3IpO1xuXG4gICAgaWYgKCFyb290KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzaG91bGRVcGRhdGU6IGZhbHNlLFxuICAgICAgICBzaG91bGRTdG9wUHJvcGFnYXRpb246IGZhbHNlLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zZXR0aW5ncy5lbnRlck91dGRlbnRzRW1wdHlMaXN0SXRlbSkge1xuICAgICAgY29uc3QgcmVzID0gdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIuZXZhbChcbiAgICAgICAgcm9vdCxcbiAgICAgICAgbmV3IE91dGRlbnRMaXN0SWZJdHNFbXB0eShyb290KSxcbiAgICAgICAgZWRpdG9yLFxuICAgICAgKTtcblxuICAgICAgaWYgKHJlcy5zaG91bGRTdG9wUHJvcGFnYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICAgIH1cbiAgICB9XG5cbiAgICB7XG4gICAgICBjb25zdCBkZWZhdWx0SW5kZW50Q2hhcnMgPSB0aGlzLm9ic2lkaWFuU2V0dGluZ3MuZ2V0RGVmYXVsdEluZGVudENoYXJzKCk7XG4gICAgICBjb25zdCB6b29tUmFuZ2UgPSBlZGl0b3IuZ2V0Wm9vbVJhbmdlKCk7XG4gICAgICBjb25zdCBnZXRab29tUmFuZ2UgPSB7XG4gICAgICAgIGdldFpvb21SYW5nZTogKCkgPT4gem9vbVJhbmdlLFxuICAgICAgfTtcblxuICAgICAgY29uc3QgcmVzID0gdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIuZXZhbChcbiAgICAgICAgcm9vdCxcbiAgICAgICAgbmV3IENyZWF0ZU5ld0l0ZW0oXG4gICAgICAgICAgcm9vdCxcbiAgICAgICAgICBkZWZhdWx0SW5kZW50Q2hhcnMsXG4gICAgICAgICAgZ2V0Wm9vbVJhbmdlLFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICAgdGhpcy5zZXR0aW5ncy5lbnRlck91dGRlbnRzRW1wdHlMaXN0SXRlbSxcbiAgICAgICAgKSxcbiAgICAgICAgZWRpdG9yLFxuICAgICAgKTtcblxuICAgICAgaWYgKHJlcy5zaG91bGRVcGRhdGUgJiYgem9vbVJhbmdlKSB7XG4gICAgICAgIGVkaXRvci50cnlSZWZyZXNoWm9vbSh6b29tUmFuZ2UuZnJvbS5saW5lKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG4gIH07XG59XG4iLCJpbXBvcnQgeyBFZGl0b3IgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVFZGl0b3JDYWxsYmFjayhjYjogKGVkaXRvcjogTXlFZGl0b3IpID0+IGJvb2xlYW4pIHtcbiAgcmV0dXJuIChlZGl0b3I6IEVkaXRvcikgPT4ge1xuICAgIGNvbnN0IG15RWRpdG9yID0gbmV3IE15RWRpdG9yKGVkaXRvcik7XG4gICAgY29uc3Qgc2hvdWxkU3RvcFByb3BhZ2F0aW9uID0gY2IobXlFZGl0b3IpO1xuXG4gICAgaWYgKFxuICAgICAgIXNob3VsZFN0b3BQcm9wYWdhdGlvbiAmJlxuICAgICAgd2luZG93LmV2ZW50ICYmXG4gICAgICB3aW5kb3cuZXZlbnQudHlwZSA9PT0gXCJrZXlkb3duXCJcbiAgICApIHtcbiAgICAgIG15RWRpdG9yLnRyaWdnZXJPbktleURvd24od2luZG93LmV2ZW50IGFzIEtleWJvYXJkRXZlbnQpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IE5vdGljZSwgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgT2JzaWRpYW5TZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PYnNpZGlhblNldHRpbmdzXCI7XG5pbXBvcnQgeyBjcmVhdGVFZGl0b3JDYWxsYmFjayB9IGZyb20gXCIuLi91dGlscy9jcmVhdGVFZGl0b3JDYWxsYmFja1wiO1xuXG5leHBvcnQgY2xhc3MgTGlzdHNGb2xkaW5nQ29tbWFuZHMgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbixcbiAgICBwcml2YXRlIG9ic2lkaWFuU2V0dGluZ3M6IE9ic2lkaWFuU2V0dGluZ3MsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMucGx1Z2luLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwiZm9sZFwiLFxuICAgICAgaWNvbjogXCJjaGV2cm9ucy1kb3duLXVwXCIsXG4gICAgICBuYW1lOiBcIkZvbGQgdGhlIGxpc3RcIixcbiAgICAgIGVkaXRvckNhbGxiYWNrOiBjcmVhdGVFZGl0b3JDYWxsYmFjayh0aGlzLmZvbGQpLFxuICAgICAgaG90a2V5czogW1xuICAgICAgICB7XG4gICAgICAgICAgbW9kaWZpZXJzOiBbXCJNb2RcIl0sXG4gICAgICAgICAga2V5OiBcIkFycm93VXBcIixcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICB0aGlzLnBsdWdpbi5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInVuZm9sZFwiLFxuICAgICAgaWNvbjogXCJjaGV2cm9ucy11cC1kb3duXCIsXG4gICAgICBuYW1lOiBcIlVuZm9sZCB0aGUgbGlzdFwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IGNyZWF0ZUVkaXRvckNhbGxiYWNrKHRoaXMudW5mb2xkKSxcbiAgICAgIGhvdGtleXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG1vZGlmaWVyczogW1wiTW9kXCJdLFxuICAgICAgICAgIGtleTogXCJBcnJvd0Rvd25cIixcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgc2V0Rm9sZChlZGl0b3I6IE15RWRpdG9yLCB0eXBlOiBcImZvbGRcIiB8IFwidW5mb2xkXCIpIHtcbiAgICBpZiAoIXRoaXMub2JzaWRpYW5TZXR0aW5ncy5nZXRGb2xkU2V0dGluZ3MoKS5mb2xkSW5kZW50KSB7XG4gICAgICBuZXcgTm90aWNlKFxuICAgICAgICBgVW5hYmxlIHRvICR7dHlwZX0gYmVjYXVzZSBmb2xkaW5nIGlzIGRpc2FibGVkLiBQbGVhc2UgZW5hYmxlIFwiRm9sZCBpbmRlbnRcIiBpbiBPYnNpZGlhbiBzZXR0aW5ncy5gLFxuICAgICAgICA1MDAwLFxuICAgICAgKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGN1cnNvciA9IGVkaXRvci5nZXRDdXJzb3IoKTtcblxuICAgIGlmICh0eXBlID09PSBcImZvbGRcIikge1xuICAgICAgZWRpdG9yLmZvbGQoY3Vyc29yLmxpbmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlZGl0b3IudW5mb2xkKGN1cnNvci5saW5lKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgZm9sZCA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMuc2V0Rm9sZChlZGl0b3IsIFwiZm9sZFwiKTtcbiAgfTtcblxuICBwcml2YXRlIHVuZm9sZCA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMuc2V0Rm9sZChlZGl0b3IsIFwidW5mb2xkXCIpO1xuICB9O1xufVxuIiwiaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4vT3BlcmF0aW9uXCI7XG5cbmltcG9ydCB7IFJvb3QsIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMgfSBmcm9tIFwiLi4vcm9vdFwiO1xuXG5leHBvcnQgY2xhc3MgSW5kZW50TGlzdCBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gIHByaXZhdGUgdXBkYXRlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcm9vdDogUm9vdCxcbiAgICBwcml2YXRlIGRlZmF1bHRJbmRlbnRDaGFyczogc3RyaW5nLFxuICApIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnN0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG5cbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJDdXJzb3IoKTtcbiAgICBjb25zdCBwYXJlbnQgPSBsaXN0LmdldFBhcmVudCgpO1xuICAgIGNvbnN0IHByZXYgPSBwYXJlbnQuZ2V0UHJldlNpYmxpbmdPZihsaXN0KTtcblxuICAgIGlmICghcHJldikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG5cbiAgICBjb25zdCBsaXN0U3RhcnRMaW5lQmVmb3JlID0gcm9vdC5nZXRDb250ZW50TGluZXNSYW5nZU9mKGxpc3QpWzBdO1xuXG4gICAgY29uc3QgaW5kZW50UG9zID0gbGlzdC5nZXRGaXJzdExpbmVJbmRlbnQoKS5sZW5ndGg7XG4gICAgbGV0IGluZGVudENoYXJzID0gXCJcIjtcblxuICAgIGlmIChpbmRlbnRDaGFycyA9PT0gXCJcIiAmJiAhcHJldi5pc0VtcHR5KCkpIHtcbiAgICAgIGluZGVudENoYXJzID0gcHJldlxuICAgICAgICAuZ2V0Q2hpbGRyZW4oKVswXVxuICAgICAgICAuZ2V0Rmlyc3RMaW5lSW5kZW50KClcbiAgICAgICAgLnNsaWNlKHByZXYuZ2V0Rmlyc3RMaW5lSW5kZW50KCkubGVuZ3RoKTtcbiAgICB9XG5cbiAgICBpZiAoaW5kZW50Q2hhcnMgPT09IFwiXCIpIHtcbiAgICAgIGluZGVudENoYXJzID0gbGlzdFxuICAgICAgICAuZ2V0Rmlyc3RMaW5lSW5kZW50KClcbiAgICAgICAgLnNsaWNlKHBhcmVudC5nZXRGaXJzdExpbmVJbmRlbnQoKS5sZW5ndGgpO1xuICAgIH1cblxuICAgIGlmIChpbmRlbnRDaGFycyA9PT0gXCJcIiAmJiAhbGlzdC5pc0VtcHR5KCkpIHtcbiAgICAgIGluZGVudENoYXJzID0gbGlzdC5nZXRDaGlsZHJlbigpWzBdLmdldEZpcnN0TGluZUluZGVudCgpO1xuICAgIH1cblxuICAgIGlmIChpbmRlbnRDaGFycyA9PT0gXCJcIikge1xuICAgICAgaW5kZW50Q2hhcnMgPSB0aGlzLmRlZmF1bHRJbmRlbnRDaGFycztcbiAgICB9XG5cbiAgICBwYXJlbnQucmVtb3ZlQ2hpbGQobGlzdCk7XG4gICAgcHJldi5hZGRBZnRlckFsbChsaXN0KTtcbiAgICBsaXN0LmluZGVudENvbnRlbnQoaW5kZW50UG9zLCBpbmRlbnRDaGFycyk7XG5cbiAgICBjb25zdCBsaXN0U3RhcnRMaW5lQWZ0ZXIgPSByb290LmdldENvbnRlbnRMaW5lc1JhbmdlT2YobGlzdClbMF07XG4gICAgY29uc3QgbGluZURpZmYgPSBsaXN0U3RhcnRMaW5lQWZ0ZXIgLSBsaXN0U3RhcnRMaW5lQmVmb3JlO1xuXG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcbiAgICByb290LnJlcGxhY2VDdXJzb3Ioe1xuICAgICAgbGluZTogY3Vyc29yLmxpbmUgKyBsaW5lRGlmZixcbiAgICAgIGNoOiBjdXJzb3IuY2ggKyBpbmRlbnRDaGFycy5sZW5ndGgsXG4gICAgfSk7XG5cbiAgICByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzKHJvb3QpO1xuICB9XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgUm9vdCwgcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBNb3ZlTGlzdERvd24gaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlO1xuICBwcml2YXRlIHVwZGF0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnN0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG5cbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJDdXJzb3IoKTtcbiAgICBjb25zdCBwYXJlbnQgPSBsaXN0LmdldFBhcmVudCgpO1xuICAgIGNvbnN0IGdyYW5kUGFyZW50ID0gcGFyZW50LmdldFBhcmVudCgpO1xuICAgIGNvbnN0IG5leHQgPSBwYXJlbnQuZ2V0TmV4dFNpYmxpbmdPZihsaXN0KTtcblxuICAgIGNvbnN0IGxpc3RTdGFydExpbmVCZWZvcmUgPSByb290LmdldENvbnRlbnRMaW5lc1JhbmdlT2YobGlzdClbMF07XG4gICAgbGV0IGluZGVudERpZmYgPSAwO1xuXG4gICAgaWYgKCFuZXh0ICYmIGdyYW5kUGFyZW50KSB7XG4gICAgICBjb25zdCBuZXdQYXJlbnQgPSBncmFuZFBhcmVudC5nZXROZXh0U2libGluZ09mKHBhcmVudCk7XG5cbiAgICAgIGlmIChuZXdQYXJlbnQpIHtcbiAgICAgICAgY29uc3Qgb2xkSW5kZW50ID0gbGlzdC5nZXRGaXJzdExpbmVJbmRlbnQoKTtcbiAgICAgICAgY29uc3QgbmV3SW5kZW50ID1cbiAgICAgICAgICBuZXdQYXJlbnQuZ2V0Q2hpbGRyZW4oKVswXT8uZ2V0Rmlyc3RMaW5lSW5kZW50KCkgPz9cbiAgICAgICAgICBuZXdQYXJlbnQuZ2V0Rmlyc3RMaW5lSW5kZW50KCkgK1xuICAgICAgICAgICAgb2xkSW5kZW50LnNsaWNlKHBhcmVudC5nZXRGaXJzdExpbmVJbmRlbnQoKS5sZW5ndGgpO1xuXG4gICAgICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG4gICAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChsaXN0KTtcbiAgICAgICAgbmV3UGFyZW50LmFkZEJlZm9yZUFsbChsaXN0KTtcbiAgICAgICAgbGlzdC51bmluZGVudENvbnRlbnQoMCwgb2xkSW5kZW50Lmxlbmd0aCk7XG4gICAgICAgIGxpc3QuaW5kZW50Q29udGVudCgwLCBuZXdJbmRlbnQpO1xuICAgICAgICBpbmRlbnREaWZmID0gbmV3SW5kZW50Lmxlbmd0aCAtIG9sZEluZGVudC5sZW5ndGg7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChuZXh0KSB7XG4gICAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKGxpc3QpO1xuICAgICAgcGFyZW50LmFkZEFmdGVyKG5leHQsIGxpc3QpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy51cGRhdGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbGlzdFN0YXJ0TGluZUFmdGVyID0gcm9vdC5nZXRDb250ZW50TGluZXNSYW5nZU9mKGxpc3QpWzBdO1xuICAgIGNvbnN0IGxpbmVEaWZmID0gbGlzdFN0YXJ0TGluZUFmdGVyIC0gbGlzdFN0YXJ0TGluZUJlZm9yZTtcblxuICAgIGNvbnN0IGN1cnNvciA9IHJvb3QuZ2V0Q3Vyc29yKCk7XG4gICAgcm9vdC5yZXBsYWNlQ3Vyc29yKHtcbiAgICAgIGxpbmU6IGN1cnNvci5saW5lICsgbGluZURpZmYsXG4gICAgICBjaDogY3Vyc29yLmNoICsgaW5kZW50RGlmZixcbiAgICB9KTtcblxuICAgIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMocm9vdCk7XG4gIH1cbn1cbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBSb290LCByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzIH0gZnJvbSBcIi4uL3Jvb3RcIjtcblxuZXhwb3J0IGNsYXNzIE1vdmVMaXN0VXAgaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlO1xuICBwcml2YXRlIHVwZGF0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnN0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG5cbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJDdXJzb3IoKTtcbiAgICBjb25zdCBwYXJlbnQgPSBsaXN0LmdldFBhcmVudCgpO1xuICAgIGNvbnN0IGdyYW5kUGFyZW50ID0gcGFyZW50LmdldFBhcmVudCgpO1xuICAgIGNvbnN0IHByZXYgPSBwYXJlbnQuZ2V0UHJldlNpYmxpbmdPZihsaXN0KTtcblxuICAgIGNvbnN0IGxpc3RTdGFydExpbmVCZWZvcmUgPSByb290LmdldENvbnRlbnRMaW5lc1JhbmdlT2YobGlzdClbMF07XG4gICAgbGV0IGluZGVudERpZmYgPSAwO1xuXG4gICAgaWYgKCFwcmV2ICYmIGdyYW5kUGFyZW50KSB7XG4gICAgICBjb25zdCBuZXdQYXJlbnQgPSBncmFuZFBhcmVudC5nZXRQcmV2U2libGluZ09mKHBhcmVudCk7XG5cbiAgICAgIGlmIChuZXdQYXJlbnQpIHtcbiAgICAgICAgY29uc3Qgb2xkSW5kZW50ID0gbGlzdC5nZXRGaXJzdExpbmVJbmRlbnQoKTtcbiAgICAgICAgY29uc3QgbmV3SW5kZW50ID1cbiAgICAgICAgICBuZXdQYXJlbnQuZ2V0Q2hpbGRyZW4oKS5sYXN0KCk/LmdldEZpcnN0TGluZUluZGVudCgpID8/XG4gICAgICAgICAgbmV3UGFyZW50LmdldEZpcnN0TGluZUluZGVudCgpICtcbiAgICAgICAgICAgIG9sZEluZGVudC5zbGljZShwYXJlbnQuZ2V0Rmlyc3RMaW5lSW5kZW50KCkubGVuZ3RoKTtcblxuICAgICAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuICAgICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQobGlzdCk7XG4gICAgICAgIG5ld1BhcmVudC5hZGRBZnRlckFsbChsaXN0KTtcbiAgICAgICAgbGlzdC51bmluZGVudENvbnRlbnQoMCwgb2xkSW5kZW50Lmxlbmd0aCk7XG4gICAgICAgIGxpc3QuaW5kZW50Q29udGVudCgwLCBuZXdJbmRlbnQpO1xuICAgICAgICBpbmRlbnREaWZmID0gbmV3SW5kZW50Lmxlbmd0aCAtIG9sZEluZGVudC5sZW5ndGg7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChwcmV2KSB7XG4gICAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKGxpc3QpO1xuICAgICAgcGFyZW50LmFkZEJlZm9yZShwcmV2LCBsaXN0KTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMudXBkYXRlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxpc3RTdGFydExpbmVBZnRlciA9IHJvb3QuZ2V0Q29udGVudExpbmVzUmFuZ2VPZihsaXN0KVswXTtcbiAgICBjb25zdCBsaW5lRGlmZiA9IGxpc3RTdGFydExpbmVBZnRlciAtIGxpc3RTdGFydExpbmVCZWZvcmU7XG5cbiAgICBjb25zdCBjdXJzb3IgPSByb290LmdldEN1cnNvcigpO1xuICAgIHJvb3QucmVwbGFjZUN1cnNvcih7XG4gICAgICBsaW5lOiBjdXJzb3IubGluZSArIGxpbmVEaWZmLFxuICAgICAgY2g6IGN1cnNvci5jaCArIGluZGVudERpZmYsXG4gICAgfSk7XG5cbiAgICByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzKHJvb3QpO1xuICB9XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBJbmRlbnRMaXN0IH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvSW5kZW50TGlzdFwiO1xuaW1wb3J0IHsgTW92ZUxpc3REb3duIH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvTW92ZUxpc3REb3duXCI7XG5pbXBvcnQgeyBNb3ZlTGlzdFVwIH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvTW92ZUxpc3RVcFwiO1xuaW1wb3J0IHsgT3V0ZGVudExpc3QgfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9PdXRkZW50TGlzdFwiO1xuaW1wb3J0IHsgT2JzaWRpYW5TZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PYnNpZGlhblNldHRpbmdzXCI7XG5pbXBvcnQgeyBPcGVyYXRpb25QZXJmb3JtZXIgfSBmcm9tIFwiLi4vc2VydmljZXMvT3BlcmF0aW9uUGVyZm9ybWVyXCI7XG5pbXBvcnQgeyBjcmVhdGVFZGl0b3JDYWxsYmFjayB9IGZyb20gXCIuLi91dGlscy9jcmVhdGVFZGl0b3JDYWxsYmFja1wiO1xuXG5leHBvcnQgY2xhc3MgTGlzdHNNb3ZlbWVudENvbW1hbmRzIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSBvYnNpZGlhblNldHRpbmdzOiBPYnNpZGlhblNldHRpbmdzLFxuICAgIHByaXZhdGUgb3BlcmF0aW9uUGVyZm9ybWVyOiBPcGVyYXRpb25QZXJmb3JtZXIsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMucGx1Z2luLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwibW92ZS1saXN0LWl0ZW0tdXBcIixcbiAgICAgIGljb246IFwiYXJyb3ctdXBcIixcbiAgICAgIG5hbWU6IFwiTW92ZSBsaXN0IGFuZCBzdWJsaXN0cyB1cFwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IGNyZWF0ZUVkaXRvckNhbGxiYWNrKHRoaXMubW92ZUxpc3RVcCksXG4gICAgICBob3RrZXlzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBtb2RpZmllcnM6IFtcIk1vZFwiLCBcIlNoaWZ0XCJdLFxuICAgICAgICAgIGtleTogXCJBcnJvd1VwXCIsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgdGhpcy5wbHVnaW4uYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJtb3ZlLWxpc3QtaXRlbS1kb3duXCIsXG4gICAgICBpY29uOiBcImFycm93LWRvd25cIixcbiAgICAgIG5hbWU6IFwiTW92ZSBsaXN0IGFuZCBzdWJsaXN0cyBkb3duXCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogY3JlYXRlRWRpdG9yQ2FsbGJhY2sodGhpcy5tb3ZlTGlzdERvd24pLFxuICAgICAgaG90a2V5czogW1xuICAgICAgICB7XG4gICAgICAgICAgbW9kaWZpZXJzOiBbXCJNb2RcIiwgXCJTaGlmdFwiXSxcbiAgICAgICAgICBrZXk6IFwiQXJyb3dEb3duXCIsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgdGhpcy5wbHVnaW4uYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJpbmRlbnQtbGlzdFwiLFxuICAgICAgaWNvbjogXCJpbmRlbnRcIixcbiAgICAgIG5hbWU6IFwiSW5kZW50IHRoZSBsaXN0IGFuZCBzdWJsaXN0c1wiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IGNyZWF0ZUVkaXRvckNhbGxiYWNrKHRoaXMuaW5kZW50TGlzdCksXG4gICAgICBob3RrZXlzOiBbXSxcbiAgICB9KTtcblxuICAgIHRoaXMucGx1Z2luLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwib3V0ZGVudC1saXN0XCIsXG4gICAgICBpY29uOiBcIm91dGRlbnRcIixcbiAgICAgIG5hbWU6IFwiT3V0ZGVudCB0aGUgbGlzdCBhbmQgc3VibGlzdHNcIixcbiAgICAgIGVkaXRvckNhbGxiYWNrOiBjcmVhdGVFZGl0b3JDYWxsYmFjayh0aGlzLm91dGRlbnRMaXN0KSxcbiAgICAgIGhvdGtleXM6IFtdLFxuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge31cblxuICBwcml2YXRlIG1vdmVMaXN0RG93biA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgY29uc3QgeyBzaG91bGRTdG9wUHJvcGFnYXRpb24gfSA9IHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLnBlcmZvcm0oXG4gICAgICAocm9vdCkgPT4gbmV3IE1vdmVMaXN0RG93bihyb290KSxcbiAgICAgIGVkaXRvcixcbiAgICApO1xuXG4gICAgcmV0dXJuIHNob3VsZFN0b3BQcm9wYWdhdGlvbjtcbiAgfTtcblxuICBwcml2YXRlIG1vdmVMaXN0VXAgPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIGNvbnN0IHsgc2hvdWxkU3RvcFByb3BhZ2F0aW9uIH0gPSB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5wZXJmb3JtKFxuICAgICAgKHJvb3QpID0+IG5ldyBNb3ZlTGlzdFVwKHJvb3QpLFxuICAgICAgZWRpdG9yLFxuICAgICk7XG5cbiAgICByZXR1cm4gc2hvdWxkU3RvcFByb3BhZ2F0aW9uO1xuICB9O1xuXG4gIHByaXZhdGUgaW5kZW50TGlzdCA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgY29uc3QgeyBzaG91bGRTdG9wUHJvcGFnYXRpb24gfSA9IHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLnBlcmZvcm0oXG4gICAgICAocm9vdCkgPT5cbiAgICAgICAgbmV3IEluZGVudExpc3Qocm9vdCwgdGhpcy5vYnNpZGlhblNldHRpbmdzLmdldERlZmF1bHRJbmRlbnRDaGFycygpKSxcbiAgICAgIGVkaXRvcixcbiAgICApO1xuXG4gICAgcmV0dXJuIHNob3VsZFN0b3BQcm9wYWdhdGlvbjtcbiAgfTtcblxuICBwcml2YXRlIG91dGRlbnRMaXN0ID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICBjb25zdCB7IHNob3VsZFN0b3BQcm9wYWdhdGlvbiB9ID0gdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIucGVyZm9ybShcbiAgICAgIChyb290KSA9PiBuZXcgT3V0ZGVudExpc3Qocm9vdCksXG4gICAgICBlZGl0b3IsXG4gICAgKTtcblxuICAgIHJldHVybiBzaG91bGRTdG9wUHJvcGFnYXRpb247XG4gIH07XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgUm9vdCB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBEZWxldGVUaWxsQ3VycmVudExpbmVDb250ZW50U3RhcnQgaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlO1xuICBwcml2YXRlIHVwZGF0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnN0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG4gICAgdGhpcy51cGRhdGVkID0gdHJ1ZTtcblxuICAgIGNvbnN0IGN1cnNvciA9IHJvb3QuZ2V0Q3Vyc29yKCk7XG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgY29uc3QgbGluZXMgPSBsaXN0LmdldExpbmVzSW5mbygpO1xuICAgIGNvbnN0IGxpbmVObyA9IGxpbmVzLmZpbmRJbmRleCgobCkgPT4gbC5mcm9tLmxpbmUgPT09IGN1cnNvci5saW5lKTtcblxuICAgIGxpbmVzW2xpbmVOb10udGV4dCA9IGxpbmVzW2xpbmVOb10udGV4dC5zbGljZShcbiAgICAgIGN1cnNvci5jaCAtIGxpbmVzW2xpbmVOb10uZnJvbS5jaCxcbiAgICApO1xuXG4gICAgbGlzdC5yZXBsYWNlTGluZXMobGluZXMubWFwKChsKSA9PiBsLnRleHQpKTtcbiAgICByb290LnJlcGxhY2VDdXJzb3IobGluZXNbbGluZU5vXS5mcm9tKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IGtleW1hcCB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgRGVsZXRlVGlsbEN1cnJlbnRMaW5lQ29udGVudFN0YXJ0IH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvRGVsZXRlVGlsbEN1cnJlbnRMaW5lQ29udGVudFN0YXJ0XCI7XG5pbXBvcnQgeyBJTUVEZXRlY3RvciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9JTUVEZXRlY3RvclwiO1xuaW1wb3J0IHsgT3BlcmF0aW9uUGVyZm9ybWVyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09wZXJhdGlvblBlcmZvcm1lclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcbmltcG9ydCB7IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrIH0gZnJvbSBcIi4uL3V0aWxzL2NyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrXCI7XG5cbmV4cG9ydCBjbGFzcyBNZXRhQmFja3NwYWNlQmVoYXZpb3VyT3ZlcnJpZGUgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbixcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgICBwcml2YXRlIGltZURldGVjdG9yOiBJTUVEZXRlY3RvcixcbiAgICBwcml2YXRlIG9wZXJhdGlvblBlcmZvcm1lcjogT3BlcmF0aW9uUGVyZm9ybWVyLFxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihcbiAgICAgIGtleW1hcC5vZihbXG4gICAgICAgIHtcbiAgICAgICAgICBtYWM6IFwibS1CYWNrc3BhY2VcIixcbiAgICAgICAgICBydW46IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKHtcbiAgICAgICAgICAgIGNoZWNrOiB0aGlzLmNoZWNrLFxuICAgICAgICAgICAgcnVuOiB0aGlzLnJ1bixcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIF0pLFxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgY2hlY2sgPSAoKSA9PiB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuc2V0dGluZ3Mua2VlcEN1cnNvcldpdGhpbkNvbnRlbnQgIT09IFwibmV2ZXJcIiAmJlxuICAgICAgIXRoaXMuaW1lRGV0ZWN0b3IuaXNPcGVuZWQoKVxuICAgICk7XG4gIH07XG5cbiAgcHJpdmF0ZSBydW4gPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIHJldHVybiB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5wZXJmb3JtKFxuICAgICAgKHJvb3QpID0+IG5ldyBEZWxldGVUaWxsQ3VycmVudExpbmVDb250ZW50U3RhcnQocm9vdCksXG4gICAgICBlZGl0b3IsXG4gICAgKTtcbiAgfTtcbn1cbiIsImltcG9ydCB7IEFwcCwgUGx1Z2luLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7XG4gIEtlZXBDdXJzb3JXaXRoaW5Db250ZW50LFxuICBTZXR0aW5ncyxcbiAgVmVydGljYWxMaW5lc0FjdGlvbixcbn0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzXCI7XG5cbmNsYXNzIE9ic2lkaWFuT3V0bGluZXJQbHVnaW5TZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHBsdWdpbjogUGx1Z2luLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICApIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlN0aWNrIHRoZSBjdXJzb3IgdG8gdGhlIGNvbnRlbnRcIilcbiAgICAgIC5zZXREZXNjKFwiRG9uJ3QgbGV0IHRoZSBjdXJzb3IgbW92ZSB0byB0aGUgYnVsbGV0IHBvc2l0aW9uLlwiKVxuICAgICAgLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT4ge1xuICAgICAgICBkcm9wZG93blxuICAgICAgICAgIC5hZGRPcHRpb25zKHtcbiAgICAgICAgICAgIG5ldmVyOiBcIk5ldmVyXCIsXG4gICAgICAgICAgICBcImJ1bGxldC1vbmx5XCI6IFwiU3RpY2sgY3Vyc29yIG91dCBvZiBidWxsZXRzXCIsXG4gICAgICAgICAgICBcImJ1bGxldC1hbmQtY2hlY2tib3hcIjogXCJTdGljayBjdXJzb3Igb3V0IG9mIGJ1bGxldHMgYW5kIGNoZWNrYm94ZXNcIixcbiAgICAgICAgICB9IGFzIHsgW2tleSBpbiBLZWVwQ3Vyc29yV2l0aGluQ29udGVudF06IHN0cmluZyB9KVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLmtlZXBDdXJzb3JXaXRoaW5Db250ZW50KVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWU6IEtlZXBDdXJzb3JXaXRoaW5Db250ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldHRpbmdzLmtlZXBDdXJzb3JXaXRoaW5Db250ZW50ID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnNhdmUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkVuaGFuY2UgdGhlIFRhYiBrZXlcIilcbiAgICAgIC5zZXREZXNjKFwiTWFrZSBUYWIgYW5kIFNoaWZ0LVRhYiBiZWhhdmUgdGhlIHNhbWUgYXMgb3RoZXIgb3V0bGluZXJzLlwiKVxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB7XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLm92ZXJyaWRlVGFiQmVoYXZpb3VyKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3Mub3ZlcnJpZGVUYWJCZWhhdmlvdXIgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2F2ZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiRW5oYW5jZSB0aGUgRW50ZXIga2V5XCIpXG4gICAgICAuc2V0RGVzYyhcIk1ha2UgdGhlIEVudGVyIGtleSBiZWhhdmUgdGhlIHNhbWUgYXMgb3RoZXIgb3V0bGluZXJzLlwiKVxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB7XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLm92ZXJyaWRlRW50ZXJCZWhhdmlvdXIpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy5vdmVycmlkZUVudGVyQmVoYXZpb3VyID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnNhdmUoKTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGxheSgpOyAvLyBSZWZyZXNoIHRvIHNob3cvaGlkZSB0aGUgb3V0ZGVudCBzZXR0aW5nXG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIC8vIE9ubHkgc2hvdyB0aGUgb3V0ZGVudCBzZXR0aW5nIGlmIEVudGVyIGVuaGFuY2VtZW50IGlzIGVuYWJsZWRcbiAgICBpZiAodGhpcy5zZXR0aW5ncy5vdmVycmlkZUVudGVyQmVoYXZpb3VyKSB7XG4gICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgICAgLnNldE5hbWUoXCJPdXRkZW50IGVtcHR5IGl0ZW1zIHdpdGggRW50ZXJcIilcbiAgICAgICAgLnNldERlc2MoXG4gICAgICAgICAgXCJXaGVuIGVuYWJsZWQsIEVudGVyIG91dGRlbnRzIGVtcHR5IGl0ZW1zIG9yIGV4aXRzIHRoZSBsaXN0IGF0IHRoZSB0b3AgbGV2ZWwuIFdoZW4gZGlzYWJsZWQsIEVudGVyIGtlZXBzIGVtcHR5IGJ1bGxldHMgYW5kIGNoZWNrYm94ZXMgYW5kIGNvbnRpbnVlcyB0aGUgbGlzdC5cIixcbiAgICAgICAgKVxuICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHtcbiAgICAgICAgICB0b2dnbGVcbiAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLmVudGVyT3V0ZGVudHNFbXB0eUxpc3RJdGVtKVxuICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLnNldHRpbmdzLmVudGVyT3V0ZGVudHNFbXB0eUxpc3RJdGVtID0gdmFsdWU7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2F2ZSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJWaW0tbW9kZSBvL08gaW5zZXJ0cyBidWxsZXRzXCIpXG4gICAgICAuc2V0RGVzYyhcIkNyZWF0ZSBhIGJ1bGxldCB3aGVuIHByZXNzaW5nIG8gb3IgTyBpbiBWaW0gbW9kZS5cIilcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4ge1xuICAgICAgICB0b2dnbGVcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5zZXR0aW5ncy5vdmVycmlkZVZpbU9CZWhhdmlvdXIpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy5vdmVycmlkZVZpbU9CZWhhdmlvdXIgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2F2ZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiRW5oYW5jZSB0aGUgQ3RybCtBIG9yIENtZCtBIGJlaGF2aW9yXCIpXG4gICAgICAuc2V0RGVzYyhcbiAgICAgICAgXCJQcmVzcyB0aGUgaG90a2V5IG9uY2UgdG8gc2VsZWN0IHRoZSBjdXJyZW50IGxpc3QgaXRlbS4gUHJlc3MgdGhlIGhvdGtleSB0d2ljZSB0byBzZWxlY3QgdGhlIGVudGlyZSBsaXN0LlwiLFxuICAgICAgKVxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB7XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLm92ZXJyaWRlU2VsZWN0QWxsQmVoYXZpb3VyKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3Mub3ZlcnJpZGVTZWxlY3RBbGxCZWhhdmlvdXIgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2F2ZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiQXV0by1leHBhbmQgc2VsZWN0aW9uIHRvIGZ1bGwgbGlzdCBpdGVtc1wiKVxuICAgICAgLnNldERlc2MoXG4gICAgICAgIFwiV2hlbiBzZWxlY3RpbmcgYWNyb3NzIG11bHRpcGxlIGxpc3QgaXRlbXMsIGluY2x1ZGUgdGhlaXIgZnVsbCBjb250ZW50IGFuZCBjaGlsZHJlbi4gU2VsZWN0aW9ucyB3aXRoaW4gb25lIGl0ZW0gc3RheSB1bmNoYW5nZWQuXCIsXG4gICAgICApXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHtcbiAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMuc2V0dGluZ3MuZXhwYW5kU2VsZWN0aW9uKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3MuZXhwYW5kU2VsZWN0aW9uID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnNhdmUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkltcHJvdmUgdGhlIHN0eWxlIG9mIHlvdXIgbGlzdHNcIilcbiAgICAgIC5zZXREZXNjKFxuICAgICAgICBcIlN0eWxlcyBhcmUgb25seSBjb21wYXRpYmxlIHdpdGggYnVpbHQtaW4gT2JzaWRpYW4gdGhlbWVzIGFuZCBtYXkgbm90IGJlIGNvbXBhdGlibGUgd2l0aCBvdGhlciB0aGVtZXMuXCIsXG4gICAgICApXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHtcbiAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMuc2V0dGluZ3MuYmV0dGVyTGlzdHNTdHlsZXMpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy5iZXR0ZXJMaXN0c1N0eWxlcyA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXR0aW5ncy5zYXZlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJEcmF3IHZlcnRpY2FsIGluZGVudGF0aW9uIGxpbmVzXCIpXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHtcbiAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMuc2V0dGluZ3MudmVydGljYWxMaW5lcykub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5zZXR0aW5ncy52ZXJ0aWNhbExpbmVzID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5zZXR0aW5ncy5zYXZlKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiVmVydGljYWwgaW5kZW50YXRpb24gbGluZSBjbGljayBhY3Rpb25cIilcbiAgICAgIC5hZGREcm9wZG93bigoZHJvcGRvd24pID0+IHtcbiAgICAgICAgZHJvcGRvd25cbiAgICAgICAgICAuYWRkT3B0aW9ucyh7XG4gICAgICAgICAgICBub25lOiBcIk5vbmVcIixcbiAgICAgICAgICAgIFwiem9vbS1pblwiOiBcIlpvb20gSW5cIixcbiAgICAgICAgICAgIFwidG9nZ2xlLWZvbGRpbmdcIjogXCJUb2dnbGUgRm9sZGluZ1wiLFxuICAgICAgICAgIH0gYXMgeyBba2V5IGluIFZlcnRpY2FsTGluZXNBY3Rpb25dOiBzdHJpbmcgfSlcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5zZXR0aW5ncy52ZXJ0aWNhbExpbmVzQWN0aW9uKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWU6IFZlcnRpY2FsTGluZXNBY3Rpb24pID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3MudmVydGljYWxMaW5lc0FjdGlvbiA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXR0aW5ncy5zYXZlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiRHJhZy1hbmQtRHJvcFwiKS5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4ge1xuICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMuc2V0dGluZ3MuZHJhZ0FuZERyb3ApLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICB0aGlzLnNldHRpbmdzLmRyYWdBbmREcm9wID0gdmFsdWU7XG4gICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2F2ZSgpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiRGVidWcgbW9kZVwiKVxuICAgICAgLnNldERlc2MoXG4gICAgICAgIFwiT3BlbiBEZXZUb29scyAoQ29tbWFuZCtPcHRpb24rSSBvciBDb250cm9sK1NoaWZ0K0kpIHRvIGNvcHkgdGhlIGRlYnVnIGxvZ3MuXCIsXG4gICAgICApXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHtcbiAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMuc2V0dGluZ3MuZGVidWcpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMuc2V0dGluZ3MuZGVidWcgPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnNhdmUoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU2V0dGluZ3NUYWIgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbixcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4uYWRkU2V0dGluZ1RhYihcbiAgICAgIG5ldyBPYnNpZGlhbk91dGxpbmVyUGx1Z2luU2V0dGluZ1RhYihcbiAgICAgICAgdGhpcy5wbHVnaW4uYXBwLFxuICAgICAgICB0aGlzLnBsdWdpbixcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHt9XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgUHJlYyB9IGZyb20gXCJAY29kZW1pcnJvci9zdGF0ZVwiO1xuaW1wb3J0IHsga2V5bWFwIH0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBPdXRkZW50TGlzdCB9IGZyb20gXCIuLi9vcGVyYXRpb25zL091dGRlbnRMaXN0XCI7XG5pbXBvcnQgeyBJTUVEZXRlY3RvciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9JTUVEZXRlY3RvclwiO1xuaW1wb3J0IHsgT3BlcmF0aW9uUGVyZm9ybWVyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09wZXJhdGlvblBlcmZvcm1lclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcbmltcG9ydCB7IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrIH0gZnJvbSBcIi4uL3V0aWxzL2NyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrXCI7XG5cbmV4cG9ydCBjbGFzcyBTaGlmdFRhYkJlaGF2aW91ck92ZXJyaWRlIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSBpbWVEZXRlY3RvcjogSU1FRGV0ZWN0b3IsXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBvcGVyYXRpb25QZXJmb3JtZXI6IE9wZXJhdGlvblBlcmZvcm1lcixcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFZGl0b3JFeHRlbnNpb24oXG4gICAgICBQcmVjLmhpZ2hlc3QoXG4gICAgICAgIGtleW1hcC5vZihbXG4gICAgICAgICAge1xuICAgICAgICAgICAga2V5OiBcInMtVGFiXCIsXG4gICAgICAgICAgICBydW46IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKHtcbiAgICAgICAgICAgICAgY2hlY2s6IHRoaXMuY2hlY2ssXG4gICAgICAgICAgICAgIHJ1bjogdGhpcy5ydW4sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICB9LFxuICAgICAgICBdKSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHt9XG5cbiAgcHJpdmF0ZSBjaGVjayA9ICgpID0+IHtcbiAgICByZXR1cm4gdGhpcy5zZXR0aW5ncy5vdmVycmlkZVRhYkJlaGF2aW91ciAmJiAhdGhpcy5pbWVEZXRlY3Rvci5pc09wZW5lZCgpO1xuICB9O1xuXG4gIHByaXZhdGUgcnVuID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICByZXR1cm4gdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIucGVyZm9ybShcbiAgICAgIChyb290KSA9PiBuZXcgT3V0ZGVudExpc3Qocm9vdCksXG4gICAgICBlZGl0b3IsXG4gICAgKTtcbiAgfTtcbn1cbiIsImltcG9ydCB7IEFwcCwgTW9kYWwsIFBsdWdpbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgeyBGZWF0dXJlIH0gZnJvbSBcIi4vRmVhdHVyZVwiO1xuXG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9TZXR0aW5nc1wiO1xuXG5pbnRlcmZhY2UgQXBwSGlkZGVuUHJvcHMge1xuICBpbnRlcm5hbFBsdWdpbnM6IHtcbiAgICBjb25maWc6IHsgW2tleTogc3RyaW5nXTogYm9vbGVhbiB9O1xuICB9O1xuICBpc01vYmlsZTogYm9vbGVhbjtcbiAgcGx1Z2luczoge1xuICAgIGVuYWJsZWRQbHVnaW5zOiBTZXQ8c3RyaW5nPjtcbiAgICBtYW5pZmVzdHM6IHsgW2tleTogc3RyaW5nXTogeyB2ZXJzaW9uOiBzdHJpbmcgfSB9O1xuICB9O1xuICB2YXVsdDoge1xuICAgIGNvbmZpZzogb2JqZWN0O1xuICB9O1xufVxuXG5jbGFzcyBTeXN0ZW1JbmZvTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgYXN5bmMgb25PcGVuKCkge1xuICAgIHRoaXMudGl0bGVFbC5zZXRUZXh0KFwiU3lzdGVtIEluZm9ybWF0aW9uXCIpO1xuXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBjb25zdCBhcHAgPSB0aGlzLmFwcCBhcyBhbnkgYXMgQXBwSGlkZGVuUHJvcHM7XG5cbiAgICBjb25zdCBkYXRhID0ge1xuICAgICAgcHJvY2Vzczoge1xuICAgICAgICBhcmNoOiBwcm9jZXNzLmFyY2gsXG4gICAgICAgIHBsYXRmb3JtOiBwcm9jZXNzLnBsYXRmb3JtLFxuICAgICAgfSxcbiAgICAgIGFwcDoge1xuICAgICAgICBpbnRlcm5hbFBsdWdpbnM6IHtcbiAgICAgICAgICBjb25maWc6IGFwcC5pbnRlcm5hbFBsdWdpbnMuY29uZmlnLFxuICAgICAgICB9LFxuICAgICAgICBpc01vYmlsZTogYXBwLmlzTW9iaWxlLFxuICAgICAgICBwbHVnaW5zOiB7XG4gICAgICAgICAgZW5hYmxlZFBsdWdpbnM6IEFycmF5LmZyb20oYXBwLnBsdWdpbnMuZW5hYmxlZFBsdWdpbnMpLFxuICAgICAgICAgIG1hbmlmZXN0czogT2JqZWN0LmtleXMoYXBwLnBsdWdpbnMubWFuaWZlc3RzKS5yZWR1Y2UoXG4gICAgICAgICAgICAoYWNjLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgYWNjW2tleV0gPSB7XG4gICAgICAgICAgICAgICAgdmVyc2lvbjogYXBwLnBsdWdpbnMubWFuaWZlc3RzW2tleV0udmVyc2lvbixcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7fSBhcyB7IFtrZXk6IHN0cmluZ106IHsgdmVyc2lvbjogc3RyaW5nIH0gfSxcbiAgICAgICAgICApLFxuICAgICAgICB9LFxuICAgICAgICB2YXVsdDoge1xuICAgICAgICAgIGNvbmZpZzogYXBwLnZhdWx0LmNvbmZpZyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBwbHVnaW46IHtcbiAgICAgICAgc2V0dGluZ3M6IHsgdmFsdWVzOiB0aGlzLnNldHRpbmdzLmdldFZhbHVlcygpIH0sXG4gICAgICB9LFxuICAgIH07XG5cbiAgICBjb25zdCB0ZXh0ID0gSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgMik7XG5cbiAgICBjb25zdCBwcmUgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVFbChcInByZVwiKTtcbiAgICBwcmUuc2V0VGV4dCh0ZXh0KTtcbiAgICBwcmUuc2V0Q3NzU3R5bGVzKHtcbiAgICAgIG92ZXJmbG93OiBcInNjcm9sbFwiLFxuICAgICAgbWF4SGVpZ2h0OiBcIjMwMHB4XCIsXG4gICAgfSk7XG5cbiAgICBjb25zdCBidXR0b24gPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVFbChcImJ1dHRvblwiKTtcbiAgICBidXR0b24uc2V0VGV4dChcIkNvcHkgYW5kIENsb3NlXCIpO1xuICAgIGJ1dHRvbi5vbkNsaWNrRXZlbnQoKCkgPT4ge1xuICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoXCJgYGBqc29uXFxuXCIgKyB0ZXh0ICsgXCJcXG5gYGBcIik7XG4gICAgICB0aGlzLmNsb3NlKCk7XG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN5c3RlbUluZm8gaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbixcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4uYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJzeXN0ZW0taW5mb1wiLFxuICAgICAgbmFtZTogXCJTaG93IFN5c3RlbSBJbmZvXCIsXG4gICAgICBjYWxsYmFjazogdGhpcy5jYWxsYmFjayxcbiAgICAgIGhvdGtleXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG1vZGlmaWVyczogW1wiTW9kXCIsIFwiU2hpZnRcIiwgXCJBbHRcIl0sXG4gICAgICAgICAga2V5OiBcIklcIixcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgY2FsbGJhY2sgPSAoKSA9PiB7XG4gICAgY29uc3QgbW9kYWwgPSBuZXcgU3lzdGVtSW5mb01vZGFsKHRoaXMucGx1Z2luLmFwcCwgdGhpcy5zZXR0aW5ncyk7XG4gICAgbW9kYWwub3BlbigpO1xuICB9O1xufVxuIiwiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IFByZWMgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivc3RhdGVcIjtcbmltcG9ydCB7IGtleW1hcCB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgSW5kZW50TGlzdCB9IGZyb20gXCIuLi9vcGVyYXRpb25zL0luZGVudExpc3RcIjtcbmltcG9ydCB7IElNRURldGVjdG9yIH0gZnJvbSBcIi4uL3NlcnZpY2VzL0lNRURldGVjdG9yXCI7XG5pbXBvcnQgeyBPYnNpZGlhblNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09ic2lkaWFuU2V0dGluZ3NcIjtcbmltcG9ydCB7IE9wZXJhdGlvblBlcmZvcm1lciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PcGVyYXRpb25QZXJmb3JtZXJcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzXCI7XG5pbXBvcnQgeyBjcmVhdGVLZXltYXBSdW5DYWxsYmFjayB9IGZyb20gXCIuLi91dGlscy9jcmVhdGVLZXltYXBSdW5DYWxsYmFja1wiO1xuXG5leHBvcnQgY2xhc3MgVGFiQmVoYXZpb3VyT3ZlcnJpZGUgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbixcbiAgICBwcml2YXRlIGltZURldGVjdG9yOiBJTUVEZXRlY3RvcixcbiAgICBwcml2YXRlIG9ic2lkaWFuU2V0dGluZ3M6IE9ic2lkaWFuU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBvcGVyYXRpb25QZXJmb3JtZXI6IE9wZXJhdGlvblBlcmZvcm1lcixcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFZGl0b3JFeHRlbnNpb24oXG4gICAgICBQcmVjLmhpZ2hlc3QoXG4gICAgICAgIGtleW1hcC5vZihbXG4gICAgICAgICAge1xuICAgICAgICAgICAga2V5OiBcIlRhYlwiLFxuICAgICAgICAgICAgcnVuOiBjcmVhdGVLZXltYXBSdW5DYWxsYmFjayh7XG4gICAgICAgICAgICAgIGNoZWNrOiB0aGlzLmNoZWNrLFxuICAgICAgICAgICAgICBydW46IHRoaXMucnVuLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgfSxcbiAgICAgICAgXSksXG4gICAgICApLFxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgY2hlY2sgPSAoKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMuc2V0dGluZ3Mub3ZlcnJpZGVUYWJCZWhhdmlvdXIgJiYgIXRoaXMuaW1lRGV0ZWN0b3IuaXNPcGVuZWQoKTtcbiAgfTtcblxuICBwcml2YXRlIHJ1biA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLnBlcmZvcm0oXG4gICAgICAocm9vdCkgPT5cbiAgICAgICAgbmV3IEluZGVudExpc3Qocm9vdCwgdGhpcy5vYnNpZGlhblNldHRpbmdzLmdldERlZmF1bHRJbmRlbnRDaGFycygpKSxcbiAgICAgIGVkaXRvcixcbiAgICApO1xuICB9O1xufVxuIiwiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7XG4gIEVkaXRvclZpZXcsXG4gIFBsdWdpblZhbHVlLFxuICBWaWV3UGx1Z2luLFxuICBWaWV3VXBkYXRlLFxufSBmcm9tIFwiQGNvZGVtaXJyb3Ivdmlld1wiO1xuXG5pbXBvcnQgeyBGZWF0dXJlIH0gZnJvbSBcIi4vRmVhdHVyZVwiO1xuXG5pbXBvcnQgeyBNeUVkaXRvciwgZ2V0RWRpdG9yRnJvbVN0YXRlIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgTGlzdCB9IGZyb20gXCIuLi9yb290XCI7XG5pbXBvcnQgeyBPYnNpZGlhblNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09ic2lkaWFuU2V0dGluZ3NcIjtcbmltcG9ydCB7IFBhcnNlciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9QYXJzZXJcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzXCI7XG5cbmNvbnN0IFZFUlRJQ0FMX0xJTkVTX0JPRFlfQ0xBU1MgPSBcIm91dGxpbmVyLXBsdWdpbi12ZXJ0aWNhbC1saW5lc1wiO1xuXG5pbnRlcmZhY2UgTGluZURhdGEge1xuICB0b3A6IG51bWJlcjtcbiAgbGVmdDogbnVtYmVyO1xuICBoZWlnaHQ6IHN0cmluZztcbiAgbGlzdDogTGlzdDtcbn1cblxuY2xhc3MgVmVydGljYWxMaW5lc1BsdWdpblZhbHVlIGltcGxlbWVudHMgUGx1Z2luVmFsdWUge1xuICBwcml2YXRlIHNjaGVkdWxlZDogUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD47XG4gIHByaXZhdGUgc2Nyb2xsZXI6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGNvbnRlbnRDb250YWluZXI6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGVkaXRvcjogTXlFZGl0b3I7XG4gIHByaXZhdGUgbGFzdExpbmU6IG51bWJlcjtcbiAgcHJpdmF0ZSBsaW5lczogTGluZURhdGFbXTtcbiAgcHJpdmF0ZSBsaW5lRWxlbWVudHM6IEhUTUxFbGVtZW50W10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgICBwcml2YXRlIG9ic2lkaWFuU2V0dGluZ3M6IE9ic2lkaWFuU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBwYXJzZXI6IFBhcnNlcixcbiAgICBwcml2YXRlIHZpZXc6IEVkaXRvclZpZXcsXG4gICkge1xuICAgIHRoaXMudmlldy5zY3JvbGxET00uYWRkRXZlbnRMaXN0ZW5lcihcInNjcm9sbFwiLCB0aGlzLm9uU2Nyb2xsKTtcbiAgICB0aGlzLnNldHRpbmdzLm9uQ2hhbmdlKHRoaXMuc2NoZWR1bGVSZWNhbGN1bGF0ZSk7XG5cbiAgICB0aGlzLnByZXBhcmVEb20oKTtcbiAgICB0aGlzLndhaXRGb3JFZGl0b3IoKTtcbiAgfVxuXG4gIHByaXZhdGUgd2FpdEZvckVkaXRvciA9ICgpID0+IHtcbiAgICBjb25zdCBlZGl0b3IgPSBnZXRFZGl0b3JGcm9tU3RhdGUodGhpcy52aWV3LnN0YXRlKTtcbiAgICBpZiAoIWVkaXRvcikge1xuICAgICAgc2V0VGltZW91dCh0aGlzLndhaXRGb3JFZGl0b3IsIDApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLmVkaXRvciA9IGVkaXRvcjtcbiAgICB0aGlzLnNjaGVkdWxlUmVjYWxjdWxhdGUoKTtcbiAgfTtcblxuICBwcml2YXRlIHByZXBhcmVEb20oKSB7XG4gICAgdGhpcy5jb250ZW50Q29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICB0aGlzLmNvbnRlbnRDb250YWluZXIuY2xhc3NMaXN0LmFkZChcbiAgICAgIFwib3V0bGluZXItcGx1Z2luLWxpc3QtbGluZXMtY29udGVudC1jb250YWluZXJcIixcbiAgICApO1xuXG4gICAgdGhpcy5zY3JvbGxlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgdGhpcy5zY3JvbGxlci5jbGFzc0xpc3QuYWRkKFwib3V0bGluZXItcGx1Z2luLWxpc3QtbGluZXMtc2Nyb2xsZXJcIik7XG5cbiAgICB0aGlzLnNjcm9sbGVyLmFwcGVuZENoaWxkKHRoaXMuY29udGVudENvbnRhaW5lcik7XG4gICAgdGhpcy52aWV3LmRvbS5hcHBlbmRDaGlsZCh0aGlzLnNjcm9sbGVyKTtcbiAgfVxuXG4gIHByaXZhdGUgb25TY3JvbGwgPSAoZTogRXZlbnQpID0+IHtcbiAgICBjb25zdCB7IHNjcm9sbExlZnQsIHNjcm9sbFRvcCB9ID0gZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQ7XG4gICAgdGhpcy5zY3JvbGxlci5zY3JvbGxUbyhzY3JvbGxMZWZ0LCBzY3JvbGxUb3ApO1xuICB9O1xuXG4gIHByaXZhdGUgc2NoZWR1bGVSZWNhbGN1bGF0ZSA9ICgpID0+IHtcbiAgICBjbGVhclRpbWVvdXQodGhpcy5zY2hlZHVsZWQpO1xuICAgIHRoaXMuc2NoZWR1bGVkID0gc2V0VGltZW91dCh0aGlzLmNhbGN1bGF0ZSwgMCk7XG4gIH07XG5cbiAgdXBkYXRlKHVwZGF0ZTogVmlld1VwZGF0ZSkge1xuICAgIGlmIChcbiAgICAgIHVwZGF0ZS5kb2NDaGFuZ2VkIHx8XG4gICAgICB1cGRhdGUudmlld3BvcnRDaGFuZ2VkIHx8XG4gICAgICB1cGRhdGUuZ2VvbWV0cnlDaGFuZ2VkIHx8XG4gICAgICB1cGRhdGUudHJhbnNhY3Rpb25zLnNvbWUoKHRyKSA9PiB0ci5yZWNvbmZpZ3VyZWQpXG4gICAgKSB7XG4gICAgICB0aGlzLnNjaGVkdWxlUmVjYWxjdWxhdGUoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNhbGN1bGF0ZSA9ICgpID0+IHtcbiAgICB0aGlzLmxpbmVzID0gW107XG5cbiAgICBpZiAoXG4gICAgICB0aGlzLnNldHRpbmdzLnZlcnRpY2FsTGluZXMgJiZcbiAgICAgIHRoaXMub2JzaWRpYW5TZXR0aW5ncy5pc0RlZmF1bHRUaGVtZUVuYWJsZWQoKSAmJlxuICAgICAgdGhpcy52aWV3LnZpZXdwb3J0TGluZUJsb2Nrcy5sZW5ndGggPiAwICYmXG4gICAgICB0aGlzLnZpZXcudmlzaWJsZVJhbmdlcy5sZW5ndGggPiAwXG4gICAgKSB7XG4gICAgICBjb25zdCBmcm9tTGluZSA9IHRoaXMuZWRpdG9yLm9mZnNldFRvUG9zKHRoaXMudmlldy52aWV3cG9ydC5mcm9tKS5saW5lO1xuICAgICAgY29uc3QgdG9MaW5lID0gdGhpcy5lZGl0b3Iub2Zmc2V0VG9Qb3ModGhpcy52aWV3LnZpZXdwb3J0LnRvKS5saW5lO1xuICAgICAgY29uc3QgbGlzdHMgPSB0aGlzLnBhcnNlci5wYXJzZVJhbmdlKHRoaXMuZWRpdG9yLCBmcm9tTGluZSwgdG9MaW5lKTtcblxuICAgICAgZm9yIChjb25zdCBsaXN0IG9mIGxpc3RzKSB7XG4gICAgICAgIHRoaXMubGFzdExpbmUgPSBsaXN0LmdldENvbnRlbnRFbmQoKS5saW5lO1xuXG4gICAgICAgIGZvciAoY29uc3QgYyBvZiBsaXN0LmdldENoaWxkcmVuKCkpIHtcbiAgICAgICAgICB0aGlzLnJlY3Vyc2l2ZShjKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aGlzLmxpbmVzLnNvcnQoKGEsIGIpID0+XG4gICAgICAgIGEudG9wID09PSBiLnRvcCA/IGEubGVmdCAtIGIubGVmdCA6IGEudG9wIC0gYi50b3AsXG4gICAgICApO1xuICAgIH1cblxuICAgIHRoaXMudXBkYXRlRG9tKCk7XG4gIH07XG5cbiAgcHJpdmF0ZSBnZXROZXh0U2libGluZyhsaXN0OiBMaXN0KTogTGlzdCB8IG51bGwge1xuICAgIGxldCBsaXN0VG1wID0gbGlzdDtcbiAgICBsZXQgcCA9IGxpc3RUbXAuZ2V0UGFyZW50KCk7XG4gICAgd2hpbGUgKHApIHtcbiAgICAgIGNvbnN0IG5leHRTaWJsaW5nID0gcC5nZXROZXh0U2libGluZ09mKGxpc3RUbXApO1xuICAgICAgaWYgKG5leHRTaWJsaW5nKSB7XG4gICAgICAgIHJldHVybiBuZXh0U2libGluZztcbiAgICAgIH1cbiAgICAgIGxpc3RUbXAgPSBwO1xuICAgICAgcCA9IGxpc3RUbXAuZ2V0UGFyZW50KCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSByZWN1cnNpdmUobGlzdDogTGlzdCwgcGFyZW50Q3R4OiB7IHJvb3RMZWZ0PzogbnVtYmVyIH0gPSB7fSkge1xuICAgIGNvbnN0IGNoaWxkcmVuID0gbGlzdC5nZXRDaGlsZHJlbigpO1xuXG4gICAgaWYgKGNoaWxkcmVuLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGZyb21PZmZzZXQgPSB0aGlzLmVkaXRvci5wb3NUb09mZnNldCh7XG4gICAgICBsaW5lOiBsaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUsXG4gICAgICBjaDogbGlzdC5nZXRGaXJzdExpbmVJbmRlbnQoKS5sZW5ndGgsXG4gICAgfSk7XG4gICAgY29uc3QgbmV4dFNpYmxpbmcgPSB0aGlzLmdldE5leHRTaWJsaW5nKGxpc3QpO1xuICAgIGNvbnN0IHRpbGxPZmZzZXQgPSB0aGlzLmVkaXRvci5wb3NUb09mZnNldCh7XG4gICAgICBsaW5lOiBuZXh0U2libGluZ1xuICAgICAgICA/IG5leHRTaWJsaW5nLmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUgLSAxXG4gICAgICAgIDogdGhpcy5sYXN0TGluZSxcbiAgICAgIGNoOiAwLFxuICAgIH0pO1xuXG4gICAgbGV0IHZpc2libGVGcm9tID0gdGhpcy52aWV3LnZpc2libGVSYW5nZXNbMF0uZnJvbTtcbiAgICBsZXQgdmlzaWJsZVRvID1cbiAgICAgIHRoaXMudmlldy52aXNpYmxlUmFuZ2VzW3RoaXMudmlldy52aXNpYmxlUmFuZ2VzLmxlbmd0aCAtIDFdLnRvO1xuICAgIGNvbnN0IHpvb21SYW5nZSA9IHRoaXMuZWRpdG9yLmdldFpvb21SYW5nZSgpO1xuICAgIGlmICh6b29tUmFuZ2UpIHtcbiAgICAgIHZpc2libGVGcm9tID0gTWF0aC5tYXgoXG4gICAgICAgIHZpc2libGVGcm9tLFxuICAgICAgICB0aGlzLmVkaXRvci5wb3NUb09mZnNldCh6b29tUmFuZ2UuZnJvbSksXG4gICAgICApO1xuICAgICAgdmlzaWJsZVRvID0gTWF0aC5taW4odmlzaWJsZVRvLCB0aGlzLmVkaXRvci5wb3NUb09mZnNldCh6b29tUmFuZ2UudG8pKTtcbiAgICB9XG5cbiAgICBpZiAoZnJvbU9mZnNldCA+IHZpc2libGVUbyB8fCB0aWxsT2Zmc2V0IDwgdmlzaWJsZUZyb20pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjb29yZHMgPSB0aGlzLnZpZXcuY29vcmRzQXRQb3MoZnJvbU9mZnNldCwgMSk7XG4gICAgaWYgKCFjb29yZHMpIHtcbiAgICAgIC8vIFNraXAgdGhpcyBzdWJ0cmVlIHdoaWxlIGl0cyBzdGFydGluZyBjb29yZGluYXRlcyBhcmUgdW5hdmFpbGFibGUuXG4gICAgICAvLyBBIGxhdGVyIGVkaXRvciB1cGRhdGUgY2FuIHJlZHJhdyBpdCBpZiB0aGUgY29vcmRpbmF0ZXMgYmVjb21lIGF2YWlsYWJsZS5cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHBhcmVudEN0eC5yb290TGVmdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBwYXJlbnRDdHgucm9vdExlZnQgPSBjb29yZHMubGVmdDtcbiAgICB9XG4gICAgY29uc3QgbGVmdCA9IE1hdGguZmxvb3IoY29vcmRzLnJpZ2h0IC0gcGFyZW50Q3R4LnJvb3RMZWZ0KTtcblxuICAgIGNvbnN0IHRvcCA9XG4gICAgICB2aXNpYmxlRnJvbSA+IDAgJiYgZnJvbU9mZnNldCA8IHZpc2libGVGcm9tXG4gICAgICAgID8gLTIwXG4gICAgICAgIDogdGhpcy52aWV3LmxpbmVCbG9ja0F0KGZyb21PZmZzZXQpLnRvcDtcbiAgICBjb25zdCBib3R0b20gPVxuICAgICAgdGlsbE9mZnNldCA+IHZpc2libGVUb1xuICAgICAgICA/IHRoaXMudmlldy5saW5lQmxvY2tBdCh2aXNpYmxlVG8gLSAxKS5ib3R0b21cbiAgICAgICAgOiB0aGlzLnZpZXcubGluZUJsb2NrQXQodGlsbE9mZnNldCkuYm90dG9tO1xuICAgIGNvbnN0IGhlaWdodCA9IGJvdHRvbSAtIHRvcDtcblxuICAgIGlmIChoZWlnaHQgPiAwICYmICFsaXN0LmlzRm9sZGVkKCkpIHtcbiAgICAgIGNvbnN0IG5leHRTaWJsaW5nID0gbGlzdC5nZXRQYXJlbnQoKS5nZXROZXh0U2libGluZ09mKGxpc3QpO1xuICAgICAgY29uc3QgaGFzTmV4dFNpYmxpbmcgPVxuICAgICAgICAhIW5leHRTaWJsaW5nICYmXG4gICAgICAgIHRoaXMuZWRpdG9yLnBvc1RvT2Zmc2V0KG5leHRTaWJsaW5nLmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpKSA8PVxuICAgICAgICAgIHZpc2libGVUbztcblxuICAgICAgdGhpcy5saW5lcy5wdXNoKHtcbiAgICAgICAgdG9wLFxuICAgICAgICBsZWZ0LFxuICAgICAgICBoZWlnaHQ6IGBjYWxjKCR7aGVpZ2h0fXB4ICR7aGFzTmV4dFNpYmxpbmcgPyBcIi0gMS41ZW1cIiA6IFwiLSAyZW1cIn0pYCxcbiAgICAgICAgbGlzdCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgY2hpbGQgb2YgY2hpbGRyZW4pIHtcbiAgICAgIGlmICghY2hpbGQuaXNFbXB0eSgpKSB7XG4gICAgICAgIHRoaXMucmVjdXJzaXZlKGNoaWxkLCBwYXJlbnRDdHgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgb25DbGljayA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgY29uc3QgbGluZSA9IHRoaXMubGluZXNbTnVtYmVyKChlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkuZGF0YXNldC5pbmRleCldO1xuXG4gICAgc3dpdGNoICh0aGlzLnNldHRpbmdzLnZlcnRpY2FsTGluZXNBY3Rpb24pIHtcbiAgICAgIGNhc2UgXCJ6b29tLWluXCI6XG4gICAgICAgIHRoaXMuem9vbUluKGxpbmUpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBcInRvZ2dsZS1mb2xkaW5nXCI6XG4gICAgICAgIHRoaXMudG9nZ2xlRm9sZGluZyhsaW5lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9O1xuXG4gIHByaXZhdGUgem9vbUluKGxpbmU6IExpbmVEYXRhKSB7XG4gICAgY29uc3QgZWRpdG9yID0gZ2V0RWRpdG9yRnJvbVN0YXRlKHRoaXMudmlldy5zdGF0ZSk7XG5cbiAgICBlZGl0b3Iuem9vbUluKGxpbmUubGlzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKS5saW5lKTtcbiAgfVxuXG4gIHByaXZhdGUgdG9nZ2xlRm9sZGluZyhsaW5lOiBMaW5lRGF0YSkge1xuICAgIGNvbnN0IHsgbGlzdCB9ID0gbGluZTtcblxuICAgIGlmIChsaXN0LmlzRW1wdHkoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxldCBuZWVkVG9VbmZvbGQgPSB0cnVlO1xuICAgIGNvbnN0IGxpbmVzVG9Ub2dnbGU6IG51bWJlcltdID0gW107XG4gICAgZm9yIChjb25zdCBjIG9mIGxpc3QuZ2V0Q2hpbGRyZW4oKSkge1xuICAgICAgaWYgKGMuaXNFbXB0eSgpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKCFjLmlzRm9sZGVkKCkpIHtcbiAgICAgICAgbmVlZFRvVW5mb2xkID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBsaW5lc1RvVG9nZ2xlLnB1c2goYy5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKS5saW5lKTtcbiAgICB9XG5cbiAgICBjb25zdCBlZGl0b3IgPSBnZXRFZGl0b3JGcm9tU3RhdGUodGhpcy52aWV3LnN0YXRlKTtcblxuICAgIGZvciAoY29uc3QgbCBvZiBsaW5lc1RvVG9nZ2xlKSB7XG4gICAgICBpZiAobmVlZFRvVW5mb2xkKSB7XG4gICAgICAgIGVkaXRvci51bmZvbGQobCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlZGl0b3IuZm9sZChsKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZURvbSgpIHtcbiAgICBjb25zdCBjbVNjcm9sbCA9IHRoaXMudmlldy5zY3JvbGxET007XG4gICAgY29uc3QgY21Db250ZW50ID0gdGhpcy52aWV3LmNvbnRlbnRET007XG4gICAgY29uc3QgY21Db250ZW50Q29udGFpbmVyID0gY21Db250ZW50LnBhcmVudEVsZW1lbnQ7XG4gICAgY29uc3QgY21TaXplciA9IGNtQ29udGVudENvbnRhaW5lci5wYXJlbnRFbGVtZW50O1xuXG4gICAgLyoqXG4gICAgICogT2JzaWRpYW4gY2FuIGFkZCBhZGRpdGlvbmFsIGVsZW1lbnRzIGludG8gQ29udGVudCBNYW5hZ2VyLlxuICAgICAqIFRoZSBtb3N0IG9idmlvdXMgY2FzZSBpcyB0aGUgJ2VtYmVkZGVkLWJhY2tsaW5rcycgY29yZSBwbHVnaW4gdGhhdCBhZGRzIGEgbWVudSBpbnNpZGUgYSBDb250ZW50IE1hbmFnZXIuXG4gICAgICogV2UgbXVzdCB0YWtlIGhlaWdodHMgb2YgYWxsIG9mIHRoZXNlIGVsZW1lbnRzIGludG8gYWNjb3VudFxuICAgICAqIHRvIGJlIGFibGUgdG8gY2FsY3VsYXRlIHRoZSBjb3JyZWN0IHNpemUgb2YgbGluZXMnIGNvbnRhaW5lci5cbiAgICAgKi9cbiAgICBsZXQgY21TaXplckNoaWxkcmVuU3VtSGVpZ2h0ID0gMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNtU2l6ZXIuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNtU2l6ZXJDaGlsZHJlblN1bUhlaWdodCArPSBjbVNpemVyLmNoaWxkcmVuW2ldLmNsaWVudEhlaWdodDtcbiAgICB9XG5cbiAgICB0aGlzLnNjcm9sbGVyLnN0eWxlLnRvcCA9IGNtU2Nyb2xsLm9mZnNldFRvcCArIFwicHhcIjtcbiAgICB0aGlzLmNvbnRlbnRDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gY21TaXplckNoaWxkcmVuU3VtSGVpZ2h0ICsgXCJweFwiO1xuICAgIHRoaXMuY29udGVudENvbnRhaW5lci5zdHlsZS5tYXJnaW5MZWZ0ID1cbiAgICAgIGNtQ29udGVudENvbnRhaW5lci5vZmZzZXRMZWZ0ICsgXCJweFwiO1xuICAgIHRoaXMuY29udGVudENvbnRhaW5lci5zdHlsZS5tYXJnaW5Ub3AgPVxuICAgICAgKGNtQ29udGVudC5maXJzdEVsZW1lbnRDaGlsZCBhcyBIVE1MRWxlbWVudCkub2Zmc2V0VG9wIC0gMjQgKyBcInB4XCI7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh0aGlzLmxpbmVFbGVtZW50cy5sZW5ndGggPT09IGkpIHtcbiAgICAgICAgY29uc3QgZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICAgIGUuY2xhc3NMaXN0LmFkZChcIm91dGxpbmVyLXBsdWdpbi1saXN0LWxpbmVcIik7XG4gICAgICAgIGUuZGF0YXNldC5pbmRleCA9IFN0cmluZyhpKTtcbiAgICAgICAgZS5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIHRoaXMub25DbGljayk7XG4gICAgICAgIHRoaXMuY29udGVudENvbnRhaW5lci5hcHBlbmRDaGlsZChlKTtcbiAgICAgICAgdGhpcy5saW5lRWxlbWVudHMucHVzaChlKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbCA9IHRoaXMubGluZXNbaV07XG4gICAgICBjb25zdCBlID0gdGhpcy5saW5lRWxlbWVudHNbaV07XG4gICAgICBlLnN0eWxlLnRvcCA9IGwudG9wICsgXCJweFwiO1xuICAgICAgZS5zdHlsZS5sZWZ0ID0gbC5sZWZ0ICsgXCJweFwiO1xuICAgICAgZS5zdHlsZS5oZWlnaHQgPSBsLmhlaWdodDtcbiAgICAgIGUuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gdGhpcy5saW5lcy5sZW5ndGg7IGkgPCB0aGlzLmxpbmVFbGVtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZSA9IHRoaXMubGluZUVsZW1lbnRzW2ldO1xuICAgICAgZS5zdHlsZS50b3AgPSBcIjBweFwiO1xuICAgICAgZS5zdHlsZS5sZWZ0ID0gXCIwcHhcIjtcbiAgICAgIGUuc3R5bGUuaGVpZ2h0ID0gXCIwcHhcIjtcbiAgICAgIGUuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5zZXR0aW5ncy5yZW1vdmVDYWxsYmFjayh0aGlzLnNjaGVkdWxlUmVjYWxjdWxhdGUpO1xuICAgIHRoaXMudmlldy5zY3JvbGxET00ucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInNjcm9sbFwiLCB0aGlzLm9uU2Nyb2xsKTtcbiAgICB0aGlzLnZpZXcuZG9tLnJlbW92ZUNoaWxkKHRoaXMuc2Nyb2xsZXIpO1xuICAgIGNsZWFyVGltZW91dCh0aGlzLnNjaGVkdWxlZCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFZlcnRpY2FsTGluZXMgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgcHJpdmF0ZSB1cGRhdGVCb2R5Q2xhc3NJbnRlcnZhbDogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBvYnNpZGlhblNldHRpbmdzOiBPYnNpZGlhblNldHRpbmdzLFxuICAgIHByaXZhdGUgcGFyc2VyOiBQYXJzZXIsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMudXBkYXRlQm9keUNsYXNzKCk7XG4gICAgdGhpcy51cGRhdGVCb2R5Q2xhc3NJbnRlcnZhbCA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICB0aGlzLnVwZGF0ZUJvZHlDbGFzcygpO1xuICAgIH0sIDEwMDApO1xuXG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFZGl0b3JFeHRlbnNpb24oXG4gICAgICBWaWV3UGx1Z2luLmRlZmluZShcbiAgICAgICAgKHZpZXcpID0+XG4gICAgICAgICAgbmV3IFZlcnRpY2FsTGluZXNQbHVnaW5WYWx1ZShcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgICAgICB0aGlzLm9ic2lkaWFuU2V0dGluZ3MsXG4gICAgICAgICAgICB0aGlzLnBhcnNlcixcbiAgICAgICAgICAgIHZpZXcsXG4gICAgICAgICAgKSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHtcbiAgICBjbGVhckludGVydmFsKHRoaXMudXBkYXRlQm9keUNsYXNzSW50ZXJ2YWwpO1xuICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LnJlbW92ZShWRVJUSUNBTF9MSU5FU19CT0RZX0NMQVNTKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlQm9keUNsYXNzID0gKCkgPT4ge1xuICAgIGNvbnN0IHNob3VsZEV4aXN0cyA9XG4gICAgICB0aGlzLm9ic2lkaWFuU2V0dGluZ3MuaXNEZWZhdWx0VGhlbWVFbmFibGVkKCkgJiZcbiAgICAgIHRoaXMuc2V0dGluZ3MudmVydGljYWxMaW5lcztcbiAgICBjb25zdCBleGlzdHMgPSBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5jb250YWlucyhWRVJUSUNBTF9MSU5FU19CT0RZX0NMQVNTKTtcblxuICAgIGlmIChzaG91bGRFeGlzdHMgJiYgIWV4aXN0cykge1xuICAgICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuYWRkKFZFUlRJQ0FMX0xJTkVTX0JPRFlfQ0xBU1MpO1xuICAgIH1cblxuICAgIGlmICghc2hvdWxkRXhpc3RzICYmIGV4aXN0cykge1xuICAgICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QucmVtb3ZlKFZFUlRJQ0FMX0xJTkVTX0JPRFlfQ0xBU1MpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IHR5cGUgRWRpdG9yLCBNYXJrZG93blZpZXcsIE5vdGljZSwgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgQ3JlYXRlTmV3SXRlbSB9IGZyb20gXCIuLi9vcGVyYXRpb25zL0NyZWF0ZU5ld0l0ZW1cIjtcbmltcG9ydCB7IE9ic2lkaWFuU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvT2JzaWRpYW5TZXR0aW5nc1wiO1xuaW1wb3J0IHsgT3BlcmF0aW9uUGVyZm9ybWVyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09wZXJhdGlvblBlcmZvcm1lclwiO1xuaW1wb3J0IHsgUGFyc2VyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1BhcnNlclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcblxuZGVjbGFyZSBnbG9iYWwge1xuICB0eXBlIENNID0gb2JqZWN0O1xuXG4gIGludGVyZmFjZSBWaW0ge1xuICAgIGRlZmluZUFjdGlvbjxUPihuYW1lOiBzdHJpbmcsIGZuOiAoY206IENNLCBhcmdzOiBUKSA9PiB2b2lkKTogdm9pZDtcblxuICAgIGhhbmRsZUV4KGNtOiBDTSwgY29tbWFuZDogc3RyaW5nKTogdm9pZDtcblxuICAgIGVudGVySW5zZXJ0TW9kZShjbTogQ00pOiB2b2lkO1xuXG4gICAgbWFwQ29tbWFuZChcbiAgICAgIGtleXM6IHN0cmluZyxcbiAgICAgIHR5cGU6IHN0cmluZyxcbiAgICAgIG5hbWU6IHN0cmluZyxcbiAgICAgIGFyZ3M6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgICAgZXh0cmE6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICAgICk6IHZvaWQ7XG4gIH1cblxuICBpbnRlcmZhY2UgV2luZG93IHtcbiAgICBDb2RlTWlycm9yQWRhcHRlcj86IHtcbiAgICAgIFZpbT86IFZpbTtcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBWaW1PQmVoYXZpb3VyT3ZlcnJpZGUgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgcHJpdmF0ZSBpbml0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICAgIHByaXZhdGUgb2JzaWRpYW5TZXR0aW5nczogT2JzaWRpYW5TZXR0aW5ncyxcbiAgICBwcml2YXRlIHBhcnNlcjogUGFyc2VyLFxuICAgIHByaXZhdGUgb3BlcmF0aW9uUGVyZm9ybWVyOiBPcGVyYXRpb25QZXJmb3JtZXIsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMuc2V0dGluZ3Mub25DaGFuZ2UodGhpcy5oYW5kbGVTZXR0aW5nc0NoYW5nZSk7XG4gICAgdGhpcy5oYW5kbGVTZXR0aW5nc0NoYW5nZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBtb3ZlQ3Vyc29yVG9MaW5lRW5kKGVkaXRvcjogRWRpdG9yKSB7XG4gICAgY29uc3QgY3Vyc29yID0gZWRpdG9yLmdldEN1cnNvcigpO1xuICAgIGVkaXRvci5zZXRDdXJzb3Ioe1xuICAgICAgbGluZTogY3Vyc29yLmxpbmUsXG4gICAgICBjaDogZWRpdG9yLmdldExpbmUoY3Vyc29yLmxpbmUpLmxlbmd0aCxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0TGluZUluZGVudChsaW5lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbGluZS5tYXRjaCgvXlsgXFx0XSovKVswXTtcbiAgfVxuXG4gIHByaXZhdGUgb3BlblBsYWluTGluZShlZGl0b3I6IEVkaXRvciwgYWZ0ZXI6IGJvb2xlYW4pIHtcbiAgICBjb25zdCBjdXJzb3IgPSBlZGl0b3IuZ2V0Q3Vyc29yKCk7XG4gICAgY29uc3QgbGluZSA9IGVkaXRvci5nZXRMaW5lKGN1cnNvci5saW5lKTtcbiAgICBjb25zdCBpbmRlbnQgPSB0aGlzLmdldExpbmVJbmRlbnQobGluZSk7XG5cbiAgICBpZiAoYWZ0ZXIpIHtcbiAgICAgIGNvbnN0IGluc2VydEF0ID0geyBsaW5lOiBjdXJzb3IubGluZSwgY2g6IGxpbmUubGVuZ3RoIH07XG4gICAgICBlZGl0b3IucmVwbGFjZVJhbmdlKGBcXG4ke2luZGVudH1gLCBpbnNlcnRBdCwgaW5zZXJ0QXQpO1xuICAgICAgZWRpdG9yLnNldEN1cnNvcih7IGxpbmU6IGN1cnNvci5saW5lICsgMSwgY2g6IGluZGVudC5sZW5ndGggfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGluc2VydEF0ID0geyBsaW5lOiBjdXJzb3IubGluZSwgY2g6IDAgfTtcbiAgICAgIGVkaXRvci5yZXBsYWNlUmFuZ2UoYCR7aW5kZW50fVxcbmAsIGluc2VydEF0LCBpbnNlcnRBdCk7XG4gICAgICBlZGl0b3Iuc2V0Q3Vyc29yKHsgbGluZTogY3Vyc29yLmxpbmUsIGNoOiBpbmRlbnQubGVuZ3RoIH0pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgaGFuZGxlU2V0dGluZ3NDaGFuZ2UgPSAoKSA9PiB7XG4gICAgaWYgKHRoaXMuaW5pdGVkIHx8ICF0aGlzLnNldHRpbmdzLm92ZXJyaWRlVmltT0JlaGF2aW91cikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghd2luZG93LkNvZGVNaXJyb3JBZGFwdGVyIHx8ICF3aW5kb3cuQ29kZU1pcnJvckFkYXB0ZXIuVmltKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFwiVmltIGFkYXB0ZXIgbm90IGZvdW5kXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHZpbSA9IHdpbmRvdy5Db2RlTWlycm9yQWRhcHRlci5WaW07XG4gICAgY29uc3QgcGx1Z2luID0gdGhpcy5wbHVnaW47XG4gICAgY29uc3QgcGFyc2VyID0gdGhpcy5wYXJzZXI7XG4gICAgY29uc3Qgb2JzaWRpYW5TZXR0aW5ncyA9IHRoaXMub2JzaWRpYW5TZXR0aW5ncztcbiAgICBjb25zdCBvcGVyYXRpb25QZXJmb3JtZXIgPSB0aGlzLm9wZXJhdGlvblBlcmZvcm1lcjtcbiAgICBjb25zdCBzZXR0aW5ncyA9IHRoaXMuc2V0dGluZ3M7XG5cbiAgICB2aW0uZGVmaW5lQWN0aW9uKFxuICAgICAgXCJpbnNlcnRMaW5lQWZ0ZXJCdWxsZXRcIixcbiAgICAgIChjbSwgb3BlcmF0b3JBcmdzOiB7IGFmdGVyOiBib29sZWFuIH0pID0+IHtcbiAgICAgICAgY29uc3QgdmlldyA9IHBsdWdpbi5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcbiAgICAgICAgY29uc3Qgb2JzaWRpYW5FZGl0b3IgPSB2aWV3Py5lZGl0b3I7XG5cbiAgICAgICAgaWYgKCFvYnNpZGlhbkVkaXRvcikge1xuICAgICAgICAgIHZpbS5lbnRlckluc2VydE1vZGUoY20pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubW92ZUN1cnNvclRvTGluZUVuZChvYnNpZGlhbkVkaXRvcik7XG5cbiAgICAgICAgaWYgKCFzZXR0aW5ncy5vdmVycmlkZVZpbU9CZWhhdmlvdXIpIHtcbiAgICAgICAgICB0aGlzLm9wZW5QbGFpbkxpbmUob2JzaWRpYW5FZGl0b3IsIG9wZXJhdG9yQXJncy5hZnRlcik7XG4gICAgICAgICAgdmltLmVudGVySW5zZXJ0TW9kZShjbSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZWRpdG9yID0gbmV3IE15RWRpdG9yKG9ic2lkaWFuRWRpdG9yKTtcbiAgICAgICAgY29uc3Qgcm9vdCA9IHBhcnNlci5wYXJzZShlZGl0b3IpO1xuXG4gICAgICAgIGlmICghcm9vdCkge1xuICAgICAgICAgIHRoaXMub3BlblBsYWluTGluZShvYnNpZGlhbkVkaXRvciwgb3BlcmF0b3JBcmdzLmFmdGVyKTtcbiAgICAgICAgICB2aW0uZW50ZXJJbnNlcnRNb2RlKGNtKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZWZhdWx0SW5kZW50Q2hhcnMgPSBvYnNpZGlhblNldHRpbmdzLmdldERlZmF1bHRJbmRlbnRDaGFycygpO1xuICAgICAgICBjb25zdCB6b29tUmFuZ2UgPSBlZGl0b3IuZ2V0Wm9vbVJhbmdlKCk7XG4gICAgICAgIGNvbnN0IGdldFpvb21SYW5nZSA9IHtcbiAgICAgICAgICBnZXRab29tUmFuZ2U6ICgpID0+IHpvb21SYW5nZSxcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBvcCA9IG5ldyBDcmVhdGVOZXdJdGVtKFxuICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgZGVmYXVsdEluZGVudENoYXJzLFxuICAgICAgICAgIGdldFpvb21SYW5nZSxcbiAgICAgICAgICBvcGVyYXRvckFyZ3MuYWZ0ZXIsXG4gICAgICAgICAgdHJ1ZSwgLy8gRm9yIFZpbSBtb2RlLCBhbHdheXMgdXNlIHRoZSBkZWZhdWx0IGJlaGF2aW9yIChvdXRkZW50IGVuYWJsZWQpXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IHJlcyA9IG9wZXJhdGlvblBlcmZvcm1lci5ldmFsKHJvb3QsIG9wLCBlZGl0b3IpO1xuXG4gICAgICAgIGlmIChvcC53YXNTa2lwcGVkSW5zaWRlQ29kZWJsb2NrKCkpIHtcbiAgICAgICAgICAvLyBDb2RlIGJsb2NrcyBpbnNpZGUgbGlzdCBpdGVtcyBnZXQgbm8gbmV3IGJ1bGxldDsgb3BlbiBhIHBsYWluXG4gICAgICAgICAgLy8gbGluZSBpbnN0ZWFkLCBhcyBWaW0gd291bGQuIE90aGVyIG5vLW9wIGNhc2VzIChlLmcuIGFuIGVtcHR5XG4gICAgICAgICAgLy8gaXRlbSkgaW50ZW50aW9uYWxseSBsZWF2ZSB0aGUgdGV4dCB1bmNoYW5nZWQuXG4gICAgICAgICAgdGhpcy5vcGVuUGxhaW5MaW5lKG9ic2lkaWFuRWRpdG9yLCBvcGVyYXRvckFyZ3MuYWZ0ZXIpO1xuICAgICAgICB9IGVsc2UgaWYgKHJlcy5zaG91bGRVcGRhdGUgJiYgem9vbVJhbmdlKSB7XG4gICAgICAgICAgZWRpdG9yLnRyeVJlZnJlc2hab29tKHpvb21SYW5nZS5mcm9tLmxpbmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRW5zdXJlIHRoZSBlZGl0b3IgaXMgYWx3YXlzIGxlZnQgaW4gaW5zZXJ0IG1vZGVcbiAgICAgICAgdmltLmVudGVySW5zZXJ0TW9kZShjbSk7XG4gICAgICB9LFxuICAgICk7XG5cbiAgICB2aW0ubWFwQ29tbWFuZChcbiAgICAgIFwib1wiLFxuICAgICAgXCJhY3Rpb25cIixcbiAgICAgIFwiaW5zZXJ0TGluZUFmdGVyQnVsbGV0XCIsXG4gICAgICB7fSxcbiAgICAgIHtcbiAgICAgICAgaXNFZGl0OiB0cnVlLFxuICAgICAgICBjb250ZXh0OiBcIm5vcm1hbFwiLFxuICAgICAgICBpbnRlcmxhY2VJbnNlcnRSZXBlYXQ6IHRydWUsXG4gICAgICAgIGFjdGlvbkFyZ3M6IHsgYWZ0ZXI6IHRydWUgfSxcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIHZpbS5tYXBDb21tYW5kKFxuICAgICAgXCJPXCIsXG4gICAgICBcImFjdGlvblwiLFxuICAgICAgXCJpbnNlcnRMaW5lQWZ0ZXJCdWxsZXRcIixcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBpc0VkaXQ6IHRydWUsXG4gICAgICAgIGNvbnRleHQ6IFwibm9ybWFsXCIsXG4gICAgICAgIGludGVybGFjZUluc2VydFJlcGVhdDogdHJ1ZSxcbiAgICAgICAgYWN0aW9uQXJnczogeyBhZnRlcjogZmFsc2UgfSxcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIHRoaXMuaW5pdGVkID0gdHJ1ZTtcbiAgfTtcblxuICBhc3luYyB1bmxvYWQoKSB7XG4gICAgaWYgKCF0aGlzLmluaXRlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIG5ldyBOb3RpY2UoXG4gICAgICBgVG8gZnVsbHkgdW5sb2FkIG9ic2lkaWFuLW91dGxpbmVyIHBsdWdpbiwgcGxlYXNlIHJlc3RhcnQgdGhlIGFwcGAsXG4gICAgICA1MDAwLFxuICAgICk7XG4gIH1cbn1cbiIsImltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgTGlzdCwgUG9zaXRpb24sIFJvb3QsIGlzUmFuZ2VzSW50ZXJzZWN0cyB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBDaGFuZ2VzQXBwbGljYXRvciB7XG4gIGFwcGx5KGVkaXRvcjogTXlFZGl0b3IsIHByZXZSb290OiBSb290LCBuZXdSb290OiBSb290KSB7XG4gICAgY29uc3QgY2hhbmdlcyA9IHRoaXMuY2FsY3VsYXRlQ2hhbmdlcyhlZGl0b3IsIHByZXZSb290LCBuZXdSb290KTtcbiAgICBpZiAoY2hhbmdlcykge1xuICAgICAgY29uc3QgeyByZXBsYWNlbWVudCwgY2hhbmdlRnJvbSwgY2hhbmdlVG8gfSA9IGNoYW5nZXM7XG5cbiAgICAgIGNvbnN0IHsgdW5mb2xkLCBmb2xkIH0gPSB0aGlzLmNhbGN1bGF0ZUZvbGRpbmdPcHJhdGlvbnMoXG4gICAgICAgIHByZXZSb290LFxuICAgICAgICBuZXdSb290LFxuICAgICAgICBjaGFuZ2VGcm9tLFxuICAgICAgICBjaGFuZ2VUbyxcbiAgICAgICk7XG5cbiAgICAgIGZvciAoY29uc3QgbGluZSBvZiB1bmZvbGQpIHtcbiAgICAgICAgZWRpdG9yLnVuZm9sZChsaW5lKTtcbiAgICAgIH1cblxuICAgICAgZWRpdG9yLnJlcGxhY2VSYW5nZShyZXBsYWNlbWVudCwgY2hhbmdlRnJvbSwgY2hhbmdlVG8pO1xuXG4gICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgZm9sZCkge1xuICAgICAgICBlZGl0b3IuZm9sZChsaW5lKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBlZGl0b3Iuc2V0U2VsZWN0aW9ucyhuZXdSb290LmdldFNlbGVjdGlvbnMoKSk7XG4gIH1cblxuICBwcml2YXRlIGNhbGN1bGF0ZUNoYW5nZXMoZWRpdG9yOiBNeUVkaXRvciwgcHJldlJvb3Q6IFJvb3QsIG5ld1Jvb3Q6IFJvb3QpIHtcbiAgICBjb25zdCByb290UmFuZ2UgPSBwcmV2Um9vdC5nZXRDb250ZW50UmFuZ2UoKTtcbiAgICBjb25zdCBvbGRTdHJpbmcgPSBlZGl0b3IuZ2V0UmFuZ2Uocm9vdFJhbmdlWzBdLCByb290UmFuZ2VbMV0pO1xuICAgIGNvbnN0IG5ld1N0cmluZyA9IG5ld1Jvb3QucHJpbnQoKTtcblxuICAgIGNvbnN0IGNoYW5nZUZyb20gPSB7IC4uLnJvb3RSYW5nZVswXSB9O1xuICAgIGNvbnN0IGNoYW5nZVRvID0geyAuLi5yb290UmFuZ2VbMV0gfTtcbiAgICBsZXQgb2xkVG1wID0gb2xkU3RyaW5nO1xuICAgIGxldCBuZXdUbXAgPSBuZXdTdHJpbmc7XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29uc3QgbmxJbmRleCA9IG9sZFRtcC5sYXN0SW5kZXhPZihcIlxcblwiKTtcblxuICAgICAgaWYgKG5sSW5kZXggPCAwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBvbGRMaW5lID0gb2xkVG1wLnNsaWNlKG5sSW5kZXgpO1xuICAgICAgY29uc3QgbmV3TGluZSA9IG5ld1RtcC5zbGljZSgtb2xkTGluZS5sZW5ndGgpO1xuXG4gICAgICBpZiAob2xkTGluZSAhPT0gbmV3TGluZSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgb2xkVG1wID0gb2xkVG1wLnNsaWNlKDAsIC1vbGRMaW5lLmxlbmd0aCk7XG4gICAgICBuZXdUbXAgPSBuZXdUbXAuc2xpY2UoMCwgLW9sZExpbmUubGVuZ3RoKTtcbiAgICAgIGNvbnN0IG5sSW5kZXgyID0gb2xkVG1wLmxhc3RJbmRleE9mKFwiXFxuXCIpO1xuICAgICAgY2hhbmdlVG8uY2ggPVxuICAgICAgICBubEluZGV4MiA+PSAwID8gb2xkVG1wLmxlbmd0aCAtIG5sSW5kZXgyIC0gMSA6IG9sZFRtcC5sZW5ndGg7XG4gICAgICBjaGFuZ2VUby5saW5lLS07XG4gICAgfVxuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IG5sSW5kZXggPSBvbGRUbXAuaW5kZXhPZihcIlxcblwiKTtcblxuICAgICAgaWYgKG5sSW5kZXggPCAwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBvbGRMaW5lID0gb2xkVG1wLnNsaWNlKDAsIG5sSW5kZXggKyAxKTtcbiAgICAgIGNvbnN0IG5ld0xpbmUgPSBuZXdUbXAuc2xpY2UoMCwgb2xkTGluZS5sZW5ndGgpO1xuXG4gICAgICBpZiAob2xkTGluZSAhPT0gbmV3TGluZSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY2hhbmdlRnJvbS5saW5lKys7XG4gICAgICBvbGRUbXAgPSBvbGRUbXAuc2xpY2Uob2xkTGluZS5sZW5ndGgpO1xuICAgICAgbmV3VG1wID0gbmV3VG1wLnNsaWNlKG9sZExpbmUubGVuZ3RoKTtcbiAgICB9XG5cbiAgICBpZiAob2xkVG1wID09PSBuZXdUbXApIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICByZXBsYWNlbWVudDogbmV3VG1wLFxuICAgICAgY2hhbmdlRnJvbSxcbiAgICAgIGNoYW5nZVRvLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIGNhbGN1bGF0ZUZvbGRpbmdPcHJhdGlvbnMoXG4gICAgcHJldlJvb3Q6IFJvb3QsXG4gICAgbmV3Um9vdDogUm9vdCxcbiAgICBjaGFuZ2VGcm9tOiBQb3NpdGlvbixcbiAgICBjaGFuZ2VUbzogUG9zaXRpb24sXG4gICkge1xuICAgIGNvbnN0IGNoYW5nZWRSYW5nZTogW1Bvc2l0aW9uLCBQb3NpdGlvbl0gPSBbY2hhbmdlRnJvbSwgY2hhbmdlVG9dO1xuXG4gICAgY29uc3QgcHJldkxpc3RzID0gZ2V0QWxsQ2hpbGRyZW4ocHJldlJvb3QpO1xuICAgIGNvbnN0IG5ld0xpc3RzID0gZ2V0QWxsQ2hpbGRyZW4obmV3Um9vdCk7XG5cbiAgICBjb25zdCB1bmZvbGQ6IG51bWJlcltdID0gW107XG4gICAgY29uc3QgZm9sZDogbnVtYmVyW10gPSBbXTtcblxuICAgIGZvciAoY29uc3QgcHJldkxpc3Qgb2YgcHJldkxpc3RzLnZhbHVlcygpKSB7XG4gICAgICBpZiAoIXByZXZMaXN0LmlzRm9sZFJvb3QoKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbmV3TGlzdCA9IG5ld0xpc3RzLmdldChwcmV2TGlzdC5nZXRJRCgpKTtcblxuICAgICAgaWYgKCFuZXdMaXN0KSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwcmV2TGlzdFJhbmdlOiBbUG9zaXRpb24sIFBvc2l0aW9uXSA9IFtcbiAgICAgICAgcHJldkxpc3QuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCksXG4gICAgICAgIHByZXZMaXN0LmdldENvbnRlbnRFbmRJbmNsdWRpbmdDaGlsZHJlbigpLFxuICAgICAgXTtcblxuICAgICAgaWYgKGlzUmFuZ2VzSW50ZXJzZWN0cyhwcmV2TGlzdFJhbmdlLCBjaGFuZ2VkUmFuZ2UpKSB7XG4gICAgICAgIHVuZm9sZC5wdXNoKHByZXZMaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUpO1xuICAgICAgICBmb2xkLnB1c2gobmV3TGlzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKS5saW5lKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB1bmZvbGQuc29ydCgoYSwgYikgPT4gYiAtIGEpO1xuICAgIGZvbGQuc29ydCgoYSwgYikgPT4gYiAtIGEpO1xuXG4gICAgcmV0dXJuIHsgdW5mb2xkLCBmb2xkIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0QWxsQ2hpbGRyZW5SZWR1Y2VGbihhY2M6IE1hcDxudW1iZXIsIExpc3Q+LCBjaGlsZDogTGlzdCkge1xuICBhY2Muc2V0KGNoaWxkLmdldElEKCksIGNoaWxkKTtcbiAgY2hpbGQuZ2V0Q2hpbGRyZW4oKS5yZWR1Y2UoZ2V0QWxsQ2hpbGRyZW5SZWR1Y2VGbiwgYWNjKTtcblxuICByZXR1cm4gYWNjO1xufVxuXG5mdW5jdGlvbiBnZXRBbGxDaGlsZHJlbihyb290OiBSb290KTogTWFwPG51bWJlciwgTGlzdD4ge1xuICByZXR1cm4gcm9vdC5nZXRDaGlsZHJlbigpLnJlZHVjZShnZXRBbGxDaGlsZHJlblJlZHVjZUZuLCBuZXcgTWFwKCkpO1xufVxuIiwiaW1wb3J0IHsgUGxhdGZvcm0gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuZXhwb3J0IGNsYXNzIElNRURldGVjdG9yIHtcbiAgcHJpdmF0ZSBjb21wb3NpdGlvbiA9IGZhbHNlO1xuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImNvbXBvc2l0aW9uc3RhcnRcIiwgdGhpcy5vbkNvbXBvc2l0aW9uU3RhcnQpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjb21wb3NpdGlvbmVuZFwiLCB0aGlzLm9uQ29tcG9zaXRpb25FbmQpO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJjb21wb3NpdGlvbmVuZFwiLCB0aGlzLm9uQ29tcG9zaXRpb25FbmQpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJjb21wb3NpdGlvbnN0YXJ0XCIsIHRoaXMub25Db21wb3NpdGlvblN0YXJ0KTtcbiAgfVxuXG4gIGlzT3BlbmVkKCkge1xuICAgIHJldHVybiB0aGlzLmNvbXBvc2l0aW9uICYmIFBsYXRmb3JtLmlzRGVza3RvcDtcbiAgfVxuXG4gIHByaXZhdGUgb25Db21wb3NpdGlvblN0YXJ0ID0gKCkgPT4ge1xuICAgIHRoaXMuY29tcG9zaXRpb24gPSB0cnVlO1xuICB9O1xuXG4gIHByaXZhdGUgb25Db21wb3NpdGlvbkVuZCA9ICgpID0+IHtcbiAgICB0aGlzLmNvbXBvc2l0aW9uID0gZmFsc2U7XG4gIH07XG59XG4iLCIvKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55ICovXG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuL1NldHRpbmdzXCI7XG5cbmV4cG9ydCBjbGFzcyBMb2dnZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncykge31cblxuICBsb2cobWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKSB7XG4gICAgaWYgKCF0aGlzLnNldHRpbmdzLmRlYnVnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5pbmZvKG1ldGhvZCwgLi4uYXJncyk7XG4gIH1cblxuICBiaW5kKG1ldGhvZDogc3RyaW5nKSB7XG4gICAgcmV0dXJuICguLi5hcmdzOiBhbnlbXSkgPT4gdGhpcy5sb2cobWV0aG9kLCAuLi5hcmdzKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgQXBwIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgT2JzaWRpYW5UYWJzU2V0dGluZ3Mge1xuICB1c2VUYWI6IGJvb2xlYW47XG4gIHRhYlNpemU6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBPYnNpZGlhbkZvbGRTZXR0aW5ncyB7XG4gIGZvbGRJbmRlbnQ6IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIGdldEhpZGRlbk9ic2lkaWFuQ29uZmlnKGFwcDogQXBwKSB7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gIHJldHVybiAoYXBwLnZhdWx0IGFzIGFueSkuY29uZmlnO1xufVxuXG5leHBvcnQgY2xhc3MgT2JzaWRpYW5TZXR0aW5ncyB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYXBwOiBBcHApIHt9XG5cbiAgaXNMZWdhY3lFZGl0b3JFbmFibGVkKCkge1xuICAgIGNvbnN0IGNvbmZpZzogeyBsZWdhY3lFZGl0b3I6IGJvb2xlYW4gfSA9IHtcbiAgICAgIGxlZ2FjeUVkaXRvcjogZmFsc2UsXG4gICAgICAuLi5nZXRIaWRkZW5PYnNpZGlhbkNvbmZpZyh0aGlzLmFwcCksXG4gICAgfTtcblxuICAgIHJldHVybiBjb25maWcubGVnYWN5RWRpdG9yO1xuICB9XG5cbiAgaXNEZWZhdWx0VGhlbWVFbmFibGVkKCkge1xuICAgIGNvbnN0IGNvbmZpZzogeyBjc3NUaGVtZTogc3RyaW5nIH0gPSB7XG4gICAgICBjc3NUaGVtZTogXCJcIixcbiAgICAgIC4uLmdldEhpZGRlbk9ic2lkaWFuQ29uZmlnKHRoaXMuYXBwKSxcbiAgICB9O1xuXG4gICAgcmV0dXJuIGNvbmZpZy5jc3NUaGVtZSA9PT0gXCJcIjtcbiAgfVxuXG4gIGdldFRhYnNTZXR0aW5ncygpOiBPYnNpZGlhblRhYnNTZXR0aW5ncyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHVzZVRhYjogdHJ1ZSxcbiAgICAgIHRhYlNpemU6IDQsXG4gICAgICAuLi5nZXRIaWRkZW5PYnNpZGlhbkNvbmZpZyh0aGlzLmFwcCksXG4gICAgfTtcbiAgfVxuXG4gIGdldEZvbGRTZXR0aW5ncygpOiBPYnNpZGlhbkZvbGRTZXR0aW5ncyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGZvbGRJbmRlbnQ6IHRydWUsXG4gICAgICAuLi5nZXRIaWRkZW5PYnNpZGlhbkNvbmZpZyh0aGlzLmFwcCksXG4gICAgfTtcbiAgfVxuXG4gIGdldERlZmF1bHRJbmRlbnRDaGFycygpIHtcbiAgICBjb25zdCB7IHVzZVRhYiwgdGFiU2l6ZSB9ID0gdGhpcy5nZXRUYWJzU2V0dGluZ3MoKTtcblxuICAgIHJldHVybiB1c2VUYWIgPyBcIlxcdFwiIDogbmV3IEFycmF5KHRhYlNpemUpLmZpbGwoXCIgXCIpLmpvaW4oXCJcIik7XG4gIH1cbn1cbiIsImltcG9ydCB7IENoYW5nZXNBcHBsaWNhdG9yIH0gZnJvbSBcIi4vQ2hhbmdlc0FwcGxpY2F0b3JcIjtcbmltcG9ydCB7IFBhcnNlciB9IGZyb20gXCIuL1BhcnNlclwiO1xuXG5pbXBvcnQgeyBNeUVkaXRvciB9IGZyb20gXCIuLi9lZGl0b3JcIjtcbmltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuLi9vcGVyYXRpb25zL09wZXJhdGlvblwiO1xuaW1wb3J0IHsgUm9vdCB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBPcGVyYXRpb25QZXJmb3JtZXIge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBhcnNlcjogUGFyc2VyLFxuICAgIHByaXZhdGUgY2hhbmdlc0FwcGxpY2F0b3I6IENoYW5nZXNBcHBsaWNhdG9yLFxuICApIHt9XG5cbiAgZXZhbChyb290OiBSb290LCBvcDogT3BlcmF0aW9uLCBlZGl0b3I6IE15RWRpdG9yKSB7XG4gICAgY29uc3QgcHJldlJvb3QgPSByb290LmNsb25lKCk7XG5cbiAgICBvcC5wZXJmb3JtKCk7XG5cbiAgICBpZiAob3Auc2hvdWxkVXBkYXRlKCkpIHtcbiAgICAgIHRoaXMuY2hhbmdlc0FwcGxpY2F0b3IuYXBwbHkoZWRpdG9yLCBwcmV2Um9vdCwgcm9vdCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHNob3VsZFVwZGF0ZTogb3Auc2hvdWxkVXBkYXRlKCksXG4gICAgICBzaG91bGRTdG9wUHJvcGFnYXRpb246IG9wLnNob3VsZFN0b3BQcm9wYWdhdGlvbigpLFxuICAgIH07XG4gIH1cblxuICBwZXJmb3JtKFxuICAgIGNiOiAocm9vdDogUm9vdCkgPT4gT3BlcmF0aW9uLFxuICAgIGVkaXRvcjogTXlFZGl0b3IsXG4gICAgY3Vyc29yID0gZWRpdG9yLmdldEN1cnNvcigpLFxuICApIHtcbiAgICBjb25zdCByb290ID0gdGhpcy5wYXJzZXIucGFyc2UoZWRpdG9yLCBjdXJzb3IpO1xuXG4gICAgaWYgKCFyb290KSB7XG4gICAgICByZXR1cm4geyBzaG91bGRVcGRhdGU6IGZhbHNlLCBzaG91bGRTdG9wUHJvcGFnYXRpb246IGZhbHNlIH07XG4gICAgfVxuXG4gICAgY29uc3Qgb3AgPSBjYihyb290KTtcblxuICAgIHJldHVybiB0aGlzLmV2YWwocm9vdCwgb3AsIGVkaXRvcik7XG4gIH1cbn1cbiIsImltcG9ydCB7IExvZ2dlciB9IGZyb20gXCIuL0xvZ2dlclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi9TZXR0aW5nc1wiO1xuXG5pbXBvcnQgeyBMaXN0LCBSb290IH0gZnJvbSBcIi4uL3Jvb3RcIjtcbmltcG9ydCB7IGNoZWNrYm94UmUgfSBmcm9tIFwiLi4vdXRpbHMvY2hlY2tib3hSZVwiO1xuXG5jb25zdCBidWxsZXRTaWduUmUgPSBgKD86Wy0qK118XFxcXGQrXFxcXC4pYDtcbmNvbnN0IG9wdGlvbmFsQ2hlY2tib3hSZSA9IGAoPzoke2NoZWNrYm94UmV9KT9gO1xuXG5jb25zdCBsaXN0SXRlbVdpdGhvdXRTcGFjZXNSZSA9IG5ldyBSZWdFeHAoYF4ke2J1bGxldFNpZ25SZX0oIHxcXHQpYCk7XG5jb25zdCBsaXN0SXRlbVJlID0gbmV3IFJlZ0V4cChgXlsgXFx0XSoke2J1bGxldFNpZ25SZX0oIHxcXHQpYCk7XG5jb25zdCBzdHJpbmdXaXRoU3BhY2VzUmUgPSBuZXcgUmVnRXhwKGBeWyBcXHRdK2ApO1xuY29uc3QgcGFyc2VMaXN0SXRlbVJlID0gbmV3IFJlZ0V4cChcbiAgYF4oWyBcXHRdKikoJHtidWxsZXRTaWduUmV9KSggfFxcdCkoJHtvcHRpb25hbENoZWNrYm94UmV9KSguKikkYCxcbik7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVhZGVyUG9zaXRpb24ge1xuICBsaW5lOiBudW1iZXI7XG4gIGNoOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVhZGVyU2VsZWN0aW9uIHtcbiAgYW5jaG9yOiBSZWFkZXJQb3NpdGlvbjtcbiAgaGVhZDogUmVhZGVyUG9zaXRpb247XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVhZGVyIHtcbiAgZ2V0Q3Vyc29yKCk6IFJlYWRlclBvc2l0aW9uO1xuICBnZXRMaW5lKG46IG51bWJlcik6IHN0cmluZztcbiAgbGFzdExpbmUoKTogbnVtYmVyO1xuICBsaXN0U2VsZWN0aW9ucygpOiBSZWFkZXJTZWxlY3Rpb25bXTtcbiAgZ2V0QWxsRm9sZGVkTGluZXMoKTogbnVtYmVyW107XG59XG5cbmludGVyZmFjZSBQYXJzZUxpc3RMaXN0IHtcbiAgZ2V0Rmlyc3RMaW5lSW5kZW50KCk6IHN0cmluZztcbiAgc2V0Tm90ZXNJbmRlbnQobm90ZXNJbmRlbnQ6IHN0cmluZyk6IHZvaWQ7XG4gIGdldE5vdGVzSW5kZW50KCk6IHN0cmluZyB8IG51bGw7XG4gIGFkZExpbmUodGV4dDogc3RyaW5nKTogdm9pZDtcbiAgZ2V0UGFyZW50KCk6IFBhcnNlTGlzdExpc3QgfCBudWxsO1xuICBhZGRBZnRlckFsbChsaXN0OiBQYXJzZUxpc3RMaXN0KTogdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgbG9nZ2VyOiBMb2dnZXIsXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICkge31cblxuICBwYXJzZVJhbmdlKGVkaXRvcjogUmVhZGVyLCBmcm9tTGluZSA9IDAsIHRvTGluZSA9IGVkaXRvci5sYXN0TGluZSgpKTogUm9vdFtdIHtcbiAgICBjb25zdCBsaXN0czogUm9vdFtdID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gZnJvbUxpbmU7IGkgPD0gdG9MaW5lOyBpKyspIHtcbiAgICAgIGNvbnN0IGxpbmUgPSBlZGl0b3IuZ2V0TGluZShpKTtcblxuICAgICAgaWYgKGkgPT09IGZyb21MaW5lIHx8IHRoaXMuaXNMaXN0SXRlbShsaW5lKSkge1xuICAgICAgICBjb25zdCBsaXN0ID0gdGhpcy5wYXJzZVdpdGhMaW1pdHMoZWRpdG9yLCBpLCBmcm9tTGluZSwgdG9MaW5lKTtcblxuICAgICAgICBpZiAobGlzdCkge1xuICAgICAgICAgIGxpc3RzLnB1c2gobGlzdCk7XG4gICAgICAgICAgaSA9IGxpc3QuZ2V0Q29udGVudEVuZCgpLmxpbmU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbGlzdHM7XG4gIH1cblxuICBwYXJzZShlZGl0b3I6IFJlYWRlciwgY3Vyc29yID0gZWRpdG9yLmdldEN1cnNvcigpKTogUm9vdCB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLnBhcnNlV2l0aExpbWl0cyhlZGl0b3IsIGN1cnNvci5saW5lLCAwLCBlZGl0b3IubGFzdExpbmUoKSk7XG4gIH1cblxuICBwcml2YXRlIHBhcnNlV2l0aExpbWl0cyhcbiAgICBlZGl0b3I6IFJlYWRlcixcbiAgICBwYXJzaW5nU3RhcnRMaW5lOiBudW1iZXIsXG4gICAgbGltaXRGcm9tOiBudW1iZXIsXG4gICAgbGltaXRUbzogbnVtYmVyLFxuICApOiBSb290IHwgbnVsbCB7XG4gICAgY29uc3QgZCA9IHRoaXMubG9nZ2VyLmJpbmQoXCJwYXJzZUxpc3RcIik7XG4gICAgY29uc3QgZXJyb3IgPSAobXNnOiBzdHJpbmcpOiBudWxsID0+IHtcbiAgICAgIGQobXNnKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH07XG5cbiAgICBjb25zdCBsaW5lID0gZWRpdG9yLmdldExpbmUocGFyc2luZ1N0YXJ0TGluZSk7XG5cbiAgICBsZXQgbGlzdExvb2tpbmdQb3M6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gICAgaWYgKHRoaXMuaXNMaXN0SXRlbShsaW5lKSkge1xuICAgICAgbGlzdExvb2tpbmdQb3MgPSBwYXJzaW5nU3RhcnRMaW5lO1xuICAgIH0gZWxzZSBpZiAodGhpcy5pc0xpbmVXaXRoSW5kZW50KGxpbmUpKSB7XG4gICAgICBsZXQgbGlzdExvb2tpbmdQb3NTZWFyY2ggPSBwYXJzaW5nU3RhcnRMaW5lIC0gMTtcbiAgICAgIHdoaWxlIChsaXN0TG9va2luZ1Bvc1NlYXJjaCA+PSAwKSB7XG4gICAgICAgIGNvbnN0IGxpbmUgPSBlZGl0b3IuZ2V0TGluZShsaXN0TG9va2luZ1Bvc1NlYXJjaCk7XG4gICAgICAgIGlmICh0aGlzLmlzTGlzdEl0ZW0obGluZSkpIHtcbiAgICAgICAgICBsaXN0TG9va2luZ1BvcyA9IGxpc3RMb29raW5nUG9zU2VhcmNoO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuaXNMaW5lV2l0aEluZGVudChsaW5lKSkge1xuICAgICAgICAgIGxpc3RMb29raW5nUG9zU2VhcmNoLS07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobGlzdExvb2tpbmdQb3MgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGxldCBsaXN0U3RhcnRMaW5lOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgbGlzdFN0YXJ0TGluZUxvb2t1cCA9IGxpc3RMb29raW5nUG9zO1xuICAgIHdoaWxlIChsaXN0U3RhcnRMaW5lTG9va3VwID49IDApIHtcbiAgICAgIGNvbnN0IGxpbmUgPSBlZGl0b3IuZ2V0TGluZShsaXN0U3RhcnRMaW5lTG9va3VwKTtcbiAgICAgIGlmICghdGhpcy5pc0xpc3RJdGVtKGxpbmUpICYmICF0aGlzLmlzTGluZVdpdGhJbmRlbnQobGluZSkpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5pc0xpc3RJdGVtV2l0aG91dFNwYWNlcyhsaW5lKSkge1xuICAgICAgICBsaXN0U3RhcnRMaW5lID0gbGlzdFN0YXJ0TGluZUxvb2t1cDtcbiAgICAgICAgaWYgKGxpc3RTdGFydExpbmVMb29rdXAgPD0gbGltaXRGcm9tKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxpc3RTdGFydExpbmVMb29rdXAtLTtcbiAgICB9XG5cbiAgICBpZiAobGlzdFN0YXJ0TGluZSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgbGV0IGxpc3RFbmRMaW5lID0gbGlzdExvb2tpbmdQb3M7XG4gICAgbGV0IGxpc3RFbmRMaW5lTG9va3VwID0gbGlzdExvb2tpbmdQb3M7XG4gICAgd2hpbGUgKGxpc3RFbmRMaW5lTG9va3VwIDw9IGVkaXRvci5sYXN0TGluZSgpKSB7XG4gICAgICBjb25zdCBsaW5lID0gZWRpdG9yLmdldExpbmUobGlzdEVuZExpbmVMb29rdXApO1xuICAgICAgaWYgKCF0aGlzLmlzTGlzdEl0ZW0obGluZSkgJiYgIXRoaXMuaXNMaW5lV2l0aEluZGVudChsaW5lKSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5pc0VtcHR5TGluZShsaW5lKSkge1xuICAgICAgICBsaXN0RW5kTGluZSA9IGxpc3RFbmRMaW5lTG9va3VwO1xuICAgICAgfVxuICAgICAgaWYgKGxpc3RFbmRMaW5lTG9va3VwID49IGxpbWl0VG8pIHtcbiAgICAgICAgbGlzdEVuZExpbmUgPSBsaW1pdFRvO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGxpc3RFbmRMaW5lTG9va3VwKys7XG4gICAgfVxuXG4gICAgLy8gV2hpdGVzcGFjZSB0aGF0IGNhbm5vdCBiZSByZXByZXNlbnRlZCBhcyBhIG5vdGUgc2VwYXJhdGVzIGxpc3RzLiBSZXNvbHZlXG4gICAgLy8gYm90aCBib3VuZGFyaWVzIGJlZm9yZSBidWlsZGluZyB0aGUgbW9kZWwsIHJlZ2FyZGxlc3Mgb2YgY3Vyc29yIHBvc2l0aW9uLlxuICAgIGZvciAoY29uc3QgYm91bmRhcnkgb2YgdGhpcy5maW5kV2hpdGVzcGFjZUJvdW5kYXJpZXMoXG4gICAgICBlZGl0b3IsXG4gICAgICBsaXN0U3RhcnRMaW5lLFxuICAgICAgbGlzdEVuZExpbmUsXG4gICAgKSkge1xuICAgICAgaWYgKGJvdW5kYXJ5ID09PSBwYXJzaW5nU3RhcnRMaW5lKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgaWYgKGJvdW5kYXJ5IDwgcGFyc2luZ1N0YXJ0TGluZSkge1xuICAgICAgICBsaXN0U3RhcnRMaW5lID0gYm91bmRhcnkgKyAxO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGlzdEVuZExpbmUgPSBib3VuZGFyeSAtIDE7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEEgc2VnbWVudCBtdXN0IHN0YXJ0IHdpdGggYSB0b3AtbGV2ZWwgaXRlbSwgbm90IG9ycGhhbmVkIG5vdGVzL2NoaWxkcmVuLlxuICAgIHdoaWxlIChcbiAgICAgIGxpc3RTdGFydExpbmUgPD0gcGFyc2luZ1N0YXJ0TGluZSAmJlxuICAgICAgIXRoaXMuaXNMaXN0SXRlbVdpdGhvdXRTcGFjZXMoZWRpdG9yLmdldExpbmUobGlzdFN0YXJ0TGluZSkpXG4gICAgKSB7XG4gICAgICBsaXN0U3RhcnRMaW5lKys7XG4gICAgfVxuXG4gICAgaWYgKGxpc3RTdGFydExpbmUgPiBwYXJzaW5nU3RhcnRMaW5lIHx8IGxpc3RFbmRMaW5lIDwgcGFyc2luZ1N0YXJ0TGluZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgcm9vdCA9IG5ldyBSb290KFxuICAgICAgeyBsaW5lOiBsaXN0U3RhcnRMaW5lLCBjaDogMCB9LFxuICAgICAgeyBsaW5lOiBsaXN0RW5kTGluZSwgY2g6IGVkaXRvci5nZXRMaW5lKGxpc3RFbmRMaW5lKS5sZW5ndGggfSxcbiAgICAgIGVkaXRvci5saXN0U2VsZWN0aW9ucygpLm1hcCgocikgPT4gKHtcbiAgICAgICAgYW5jaG9yOiB7IGxpbmU6IHIuYW5jaG9yLmxpbmUsIGNoOiByLmFuY2hvci5jaCB9LFxuICAgICAgICBoZWFkOiB7IGxpbmU6IHIuaGVhZC5saW5lLCBjaDogci5oZWFkLmNoIH0sXG4gICAgICB9KSksXG4gICAgKTtcblxuICAgIGxldCBjdXJyZW50UGFyZW50OiBQYXJzZUxpc3RMaXN0ID0gcm9vdC5nZXRSb290TGlzdCgpO1xuICAgIGxldCBjdXJyZW50TGlzdDogUGFyc2VMaXN0TGlzdCB8IG51bGwgPSBudWxsO1xuICAgIGxldCBjdXJyZW50SW5kZW50ID0gXCJcIjtcblxuICAgIGNvbnN0IGZvbGRlZExpbmVzID0gZWRpdG9yLmdldEFsbEZvbGRlZExpbmVzKCk7XG5cbiAgICBmb3IgKGxldCBsID0gbGlzdFN0YXJ0TGluZTsgbCA8PSBsaXN0RW5kTGluZTsgbCsrKSB7XG4gICAgICBjb25zdCBsaW5lID0gZWRpdG9yLmdldExpbmUobCk7XG4gICAgICBjb25zdCBtYXRjaGVzID0gcGFyc2VMaXN0SXRlbVJlLmV4ZWMobGluZSk7XG5cbiAgICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgIGNvbnN0IFssIGluZGVudCwgYnVsbGV0LCBzcGFjZUFmdGVyQnVsbGV0XSA9IG1hdGNoZXM7XG4gICAgICAgIGxldCBbLCAsICwgLCBvcHRpb25hbENoZWNrYm94LCBjb250ZW50XSA9IG1hdGNoZXM7XG5cbiAgICAgICAgY29udGVudCA9IG9wdGlvbmFsQ2hlY2tib3ggKyBjb250ZW50O1xuICAgICAgICBpZiAodGhpcy5zZXR0aW5ncy5rZWVwQ3Vyc29yV2l0aGluQ29udGVudCAhPT0gXCJidWxsZXQtYW5kLWNoZWNrYm94XCIpIHtcbiAgICAgICAgICBvcHRpb25hbENoZWNrYm94ID0gXCJcIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNvbXBhcmVMZW5ndGggPSBNYXRoLm1pbihjdXJyZW50SW5kZW50Lmxlbmd0aCwgaW5kZW50Lmxlbmd0aCk7XG4gICAgICAgIGNvbnN0IGluZGVudFNsaWNlID0gaW5kZW50LnNsaWNlKDAsIGNvbXBhcmVMZW5ndGgpO1xuICAgICAgICBjb25zdCBjdXJyZW50SW5kZW50U2xpY2UgPSBjdXJyZW50SW5kZW50LnNsaWNlKDAsIGNvbXBhcmVMZW5ndGgpO1xuXG4gICAgICAgIGlmIChpbmRlbnRTbGljZSAhPT0gY3VycmVudEluZGVudFNsaWNlKSB7XG4gICAgICAgICAgY29uc3QgZXhwZWN0ZWQgPSBjdXJyZW50SW5kZW50U2xpY2VcbiAgICAgICAgICAgIC5yZXBsYWNlKC8gL2csIFwiU1wiKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1xcdC9nLCBcIlRcIik7XG4gICAgICAgICAgY29uc3QgZ290ID0gaW5kZW50U2xpY2UucmVwbGFjZSgvIC9nLCBcIlNcIikucmVwbGFjZSgvXFx0L2csIFwiVFwiKTtcblxuICAgICAgICAgIHJldHVybiBlcnJvcihcbiAgICAgICAgICAgIGBVbmFibGUgdG8gcGFyc2UgbGlzdDogZXhwZWN0ZWQgaW5kZW50IFwiJHtleHBlY3RlZH1cIiwgZ290IFwiJHtnb3R9XCJgLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5kZW50Lmxlbmd0aCA+IGN1cnJlbnRJbmRlbnQubGVuZ3RoKSB7XG4gICAgICAgICAgY3VycmVudFBhcmVudCA9IGN1cnJlbnRMaXN0O1xuICAgICAgICAgIGN1cnJlbnRJbmRlbnQgPSBpbmRlbnQ7XG4gICAgICAgIH0gZWxzZSBpZiAoaW5kZW50Lmxlbmd0aCA8IGN1cnJlbnRJbmRlbnQubGVuZ3RoKSB7XG4gICAgICAgICAgd2hpbGUgKFxuICAgICAgICAgICAgY3VycmVudFBhcmVudC5nZXRGaXJzdExpbmVJbmRlbnQoKS5sZW5ndGggPj0gaW5kZW50Lmxlbmd0aCAmJlxuICAgICAgICAgICAgY3VycmVudFBhcmVudC5nZXRQYXJlbnQoKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgY3VycmVudFBhcmVudCA9IGN1cnJlbnRQYXJlbnQuZ2V0UGFyZW50KCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGN1cnJlbnRJbmRlbnQgPSBpbmRlbnQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBmb2xkUm9vdCA9IGZvbGRlZExpbmVzLmluY2x1ZGVzKGwpO1xuXG4gICAgICAgIGN1cnJlbnRMaXN0ID0gbmV3IExpc3QoXG4gICAgICAgICAgcm9vdCxcbiAgICAgICAgICBpbmRlbnQsXG4gICAgICAgICAgYnVsbGV0LFxuICAgICAgICAgIG9wdGlvbmFsQ2hlY2tib3gsXG4gICAgICAgICAgc3BhY2VBZnRlckJ1bGxldCxcbiAgICAgICAgICBjb250ZW50LFxuICAgICAgICAgIGZvbGRSb290LFxuICAgICAgICApO1xuICAgICAgICBjdXJyZW50UGFyZW50LmFkZEFmdGVyQWxsKGN1cnJlbnRMaXN0KTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pc0xpbmVXaXRoSW5kZW50KGxpbmUpKSB7XG4gICAgICAgIGlmICghY3VycmVudExpc3QpIHtcbiAgICAgICAgICByZXR1cm4gZXJyb3IoXG4gICAgICAgICAgICBgVW5hYmxlIHRvIHBhcnNlIGxpc3Q6IGV4cGVjdGVkIGxpc3QgaXRlbSwgZ290IGVtcHR5IGxpbmVgLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpbmRlbnRUb0NoZWNrID0gY3VycmVudExpc3QuZ2V0Tm90ZXNJbmRlbnQoKSB8fCBjdXJyZW50SW5kZW50O1xuXG4gICAgICAgIGlmIChsaW5lLmluZGV4T2YoaW5kZW50VG9DaGVjaykgIT09IDApIHtcbiAgICAgICAgICBjb25zdCBleHBlY3RlZCA9IGluZGVudFRvQ2hlY2sucmVwbGFjZSgvIC9nLCBcIlNcIikucmVwbGFjZSgvXFx0L2csIFwiVFwiKTtcbiAgICAgICAgICBjb25zdCBnb3QgPSBsaW5lXG4gICAgICAgICAgICAubWF0Y2goL15bIFxcdF0qLylbMF1cbiAgICAgICAgICAgIC5yZXBsYWNlKC8gL2csIFwiU1wiKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1xcdC9nLCBcIlRcIik7XG5cbiAgICAgICAgICByZXR1cm4gZXJyb3IoXG4gICAgICAgICAgICBgVW5hYmxlIHRvIHBhcnNlIGxpc3Q6IGV4cGVjdGVkIGluZGVudCBcIiR7ZXhwZWN0ZWR9XCIsIGdvdCBcIiR7Z290fVwiYCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFjdXJyZW50TGlzdC5nZXROb3Rlc0luZGVudCgpKSB7XG4gICAgICAgICAgY29uc3QgbWF0Y2hlcyA9IGxpbmUubWF0Y2goL15bIFxcdF0rLyk7XG5cbiAgICAgICAgICBpZiAoIW1hdGNoZXMgfHwgbWF0Y2hlc1swXS5sZW5ndGggPD0gY3VycmVudEluZGVudC5sZW5ndGgpIHtcbiAgICAgICAgICAgIC8vIFNraXBwaW5nIGEgbGluZSB3b3VsZCBkZXN5bmNocm9uaXplIHRoZSBtb2RlbCBhbmQgZWRpdG9yIHJhbmdlcy5cbiAgICAgICAgICAgIHJldHVybiBlcnJvcihcbiAgICAgICAgICAgICAgYFVuYWJsZSB0byBwYXJzZSBsaXN0OiBleHBlY3RlZCBzb21lIGluZGVudCwgZ290IG5vIGluZGVudGAsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGN1cnJlbnRMaXN0LnNldE5vdGVzSW5kZW50KG1hdGNoZXNbMF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY3VycmVudExpc3QuYWRkTGluZShsaW5lLnNsaWNlKGN1cnJlbnRMaXN0LmdldE5vdGVzSW5kZW50KCkubGVuZ3RoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZXJyb3IoXG4gICAgICAgICAgYFVuYWJsZSB0byBwYXJzZSBsaXN0OiBleHBlY3RlZCBsaXN0IGl0ZW0gb3Igbm90ZSwgZ290IFwiJHtsaW5lfVwiYCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcm9vdDtcbiAgfVxuXG4gIHByaXZhdGUgZmluZFdoaXRlc3BhY2VCb3VuZGFyaWVzKFxuICAgIGVkaXRvcjogUmVhZGVyLFxuICAgIGZyb21MaW5lOiBudW1iZXIsXG4gICAgdG9MaW5lOiBudW1iZXIsXG4gICk6IG51bWJlcltdIHtcbiAgICBjb25zdCBib3VuZGFyaWVzOiBudW1iZXJbXSA9IFtdO1xuICAgIGxldCBpdGVtSW5kZW50ID0gXCJcIjtcbiAgICBsZXQgbm90ZXNJbmRlbnQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG4gICAgZm9yIChsZXQgbCA9IGZyb21MaW5lOyBsIDw9IHRvTGluZTsgbCsrKSB7XG4gICAgICBjb25zdCBsaW5lID0gZWRpdG9yLmdldExpbmUobCk7XG4gICAgICBjb25zdCBpdGVtID0gcGFyc2VMaXN0SXRlbVJlLmV4ZWMobGluZSk7XG4gICAgICBpZiAoaXRlbSkge1xuICAgICAgICBpdGVtSW5kZW50ID0gaXRlbVsxXTtcbiAgICAgICAgbm90ZXNJbmRlbnQgPSBudWxsO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmlzTGluZVdpdGhJbmRlbnQobGluZSkpIHtcbiAgICAgICAgY29uc3QgaW5kZW50ID0gbGluZS5tYXRjaCgvXlsgXFx0XSsvKVswXTtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIC9eXFxzKyQvLnRlc3QobGluZSkgJiZcbiAgICAgICAgICAoIWxpbmUuc3RhcnRzV2l0aChub3Rlc0luZGVudCA/PyBpdGVtSW5kZW50KSB8fFxuICAgICAgICAgICAgKG5vdGVzSW5kZW50ID09PSBudWxsICYmIGluZGVudC5sZW5ndGggPD0gaXRlbUluZGVudC5sZW5ndGgpKVxuICAgICAgICApIHtcbiAgICAgICAgICBib3VuZGFyaWVzLnB1c2gobCk7XG4gICAgICAgICAgaXRlbUluZGVudCA9IFwiXCI7XG4gICAgICAgICAgbm90ZXNJbmRlbnQgPSBudWxsO1xuICAgICAgICB9IGVsc2UgaWYgKG5vdGVzSW5kZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgbm90ZXNJbmRlbnQgPSBpbmRlbnQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gYm91bmRhcmllcztcbiAgfVxuXG4gIHByaXZhdGUgaXNFbXB0eUxpbmUobGluZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIGxpbmUubGVuZ3RoID09PSAwO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0xpbmVXaXRoSW5kZW50KGxpbmU6IHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmdXaXRoU3BhY2VzUmUudGVzdChsaW5lKTtcbiAgfVxuXG4gIHByaXZhdGUgaXNMaXN0SXRlbShsaW5lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbGlzdEl0ZW1SZS50ZXN0KGxpbmUpO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0xpc3RJdGVtV2l0aG91dFNwYWNlcyhsaW5lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbGlzdEl0ZW1XaXRob3V0U3BhY2VzUmUudGVzdChsaW5lKTtcbiAgfVxufVxuIiwiZXhwb3J0IHR5cGUgVmVydGljYWxMaW5lc0FjdGlvbiA9IFwibm9uZVwiIHwgXCJ6b29tLWluXCIgfCBcInRvZ2dsZS1mb2xkaW5nXCI7XG5leHBvcnQgdHlwZSBLZWVwQ3Vyc29yV2l0aGluQ29udGVudCA9XG4gIFwibmV2ZXJcIiB8IFwiYnVsbGV0LW9ubHlcIiB8IFwiYnVsbGV0LWFuZC1jaGVja2JveFwiO1xuXG5pbnRlcmZhY2UgU2V0dGluZ3NPYmplY3Qge1xuICBzdHlsZUxpc3RzOiBib29sZWFuO1xuICBkZWJ1ZzogYm9vbGVhbjtcbiAgc3RpY2tDdXJzb3I6IEtlZXBDdXJzb3JXaXRoaW5Db250ZW50IHwgYm9vbGVhbjtcbiAgYmV0dGVyRW50ZXI6IGJvb2xlYW47XG4gIGJldHRlckVudGVyT3V0ZGVudDogYm9vbGVhbjtcbiAgYmV0dGVyVmltTzogYm9vbGVhbjtcbiAgYmV0dGVyVGFiOiBib29sZWFuO1xuICBzZWxlY3RBbGw6IGJvb2xlYW47XG4gIGV4cGFuZFNlbGVjdGlvbjogYm9vbGVhbjtcbiAgbGlzdExpbmVzOiBib29sZWFuO1xuICBsaXN0TGluZUFjdGlvbjogVmVydGljYWxMaW5lc0FjdGlvbjtcbiAgZG5kOiBib29sZWFuO1xuICBwcmV2aW91c1JlbGVhc2U6IHN0cmluZyB8IG51bGw7XG59XG5cbmNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFNldHRpbmdzT2JqZWN0ID0ge1xuICBzdHlsZUxpc3RzOiB0cnVlLFxuICBkZWJ1ZzogZmFsc2UsXG4gIHN0aWNrQ3Vyc29yOiBcImJ1bGxldC1hbmQtY2hlY2tib3hcIixcbiAgYmV0dGVyRW50ZXI6IHRydWUsXG4gIGJldHRlckVudGVyT3V0ZGVudDogdHJ1ZSxcbiAgYmV0dGVyVmltTzogdHJ1ZSxcbiAgYmV0dGVyVGFiOiB0cnVlLFxuICBzZWxlY3RBbGw6IHRydWUsXG4gIGV4cGFuZFNlbGVjdGlvbjogZmFsc2UsXG4gIGxpc3RMaW5lczogZmFsc2UsXG4gIGxpc3RMaW5lQWN0aW9uOiBcInRvZ2dsZS1mb2xkaW5nXCIsXG4gIGRuZDogdHJ1ZSxcbiAgcHJldmlvdXNSZWxlYXNlOiBudWxsLFxufTtcblxuZXhwb3J0IGludGVyZmFjZSBTdG9yYWdlIHtcbiAgbG9hZERhdGEoKTogUHJvbWlzZTxTZXR0aW5nc09iamVjdD47XG4gIHNhdmVEYXRhKHNldHRpbmdzOiBTZXR0aW5nc09iamVjdCk6IFByb21pc2U8dm9pZD47XG59XG5cbnR5cGUgQ2FsbGJhY2sgPSAoKSA9PiB2b2lkO1xuXG5leHBvcnQgY2xhc3MgU2V0dGluZ3Mge1xuICBwcml2YXRlIHN0b3JhZ2U6IFN0b3JhZ2U7XG4gIHByaXZhdGUgdmFsdWVzOiBTZXR0aW5nc09iamVjdDtcbiAgcHJpdmF0ZSBjYWxsYmFja3M6IFNldDxDYWxsYmFjaz47XG5cbiAgY29uc3RydWN0b3Ioc3RvcmFnZTogU3RvcmFnZSkge1xuICAgIHRoaXMuc3RvcmFnZSA9IHN0b3JhZ2U7XG4gICAgdGhpcy5jYWxsYmFja3MgPSBuZXcgU2V0KCk7XG4gIH1cblxuICBnZXQga2VlcEN1cnNvcldpdGhpbkNvbnRlbnQoKSB7XG4gICAgLy8gQWRhcHRvciBmb3IgdXNlcnMgbWlncmF0aW5nIGZyb20gb2xkZXIgdmVyc2lvbiBvZiB0aGUgcGx1Z2luLlxuICAgIGlmICh0aGlzLnZhbHVlcy5zdGlja0N1cnNvciA9PT0gdHJ1ZSkge1xuICAgICAgcmV0dXJuIFwiYnVsbGV0LWFuZC1jaGVja2JveFwiO1xuICAgIH0gZWxzZSBpZiAodGhpcy52YWx1ZXMuc3RpY2tDdXJzb3IgPT09IGZhbHNlKSB7XG4gICAgICByZXR1cm4gXCJuZXZlclwiO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnZhbHVlcy5zdGlja0N1cnNvcjtcbiAgfVxuXG4gIHNldCBrZWVwQ3Vyc29yV2l0aGluQ29udGVudCh2YWx1ZTogS2VlcEN1cnNvcldpdGhpbkNvbnRlbnQpIHtcbiAgICB0aGlzLnNldChcInN0aWNrQ3Vyc29yXCIsIHZhbHVlKTtcbiAgfVxuXG4gIGdldCBvdmVycmlkZVRhYkJlaGF2aW91cigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMuYmV0dGVyVGFiO1xuICB9XG5cbiAgc2V0IG92ZXJyaWRlVGFiQmVoYXZpb3VyKHZhbHVlOiBib29sZWFuKSB7XG4gICAgdGhpcy5zZXQoXCJiZXR0ZXJUYWJcIiwgdmFsdWUpO1xuICB9XG5cbiAgZ2V0IG92ZXJyaWRlRW50ZXJCZWhhdmlvdXIoKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVzLmJldHRlckVudGVyO1xuICB9XG5cbiAgc2V0IG92ZXJyaWRlRW50ZXJCZWhhdmlvdXIodmFsdWU6IGJvb2xlYW4pIHtcbiAgICB0aGlzLnNldChcImJldHRlckVudGVyXCIsIHZhbHVlKTtcbiAgfVxuXG4gIGdldCBlbnRlck91dGRlbnRzRW1wdHlMaXN0SXRlbSgpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMuYmV0dGVyRW50ZXJPdXRkZW50O1xuICB9XG5cbiAgc2V0IGVudGVyT3V0ZGVudHNFbXB0eUxpc3RJdGVtKHZhbHVlOiBib29sZWFuKSB7XG4gICAgdGhpcy5zZXQoXCJiZXR0ZXJFbnRlck91dGRlbnRcIiwgdmFsdWUpO1xuICB9XG5cbiAgZ2V0IG92ZXJyaWRlVmltT0JlaGF2aW91cigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMuYmV0dGVyVmltTztcbiAgfVxuXG4gIHNldCBvdmVycmlkZVZpbU9CZWhhdmlvdXIodmFsdWU6IGJvb2xlYW4pIHtcbiAgICB0aGlzLnNldChcImJldHRlclZpbU9cIiwgdmFsdWUpO1xuICB9XG5cbiAgZ2V0IG92ZXJyaWRlU2VsZWN0QWxsQmVoYXZpb3VyKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcy5zZWxlY3RBbGw7XG4gIH1cblxuICBzZXQgb3ZlcnJpZGVTZWxlY3RBbGxCZWhhdmlvdXIodmFsdWU6IGJvb2xlYW4pIHtcbiAgICB0aGlzLnNldChcInNlbGVjdEFsbFwiLCB2YWx1ZSk7XG4gIH1cblxuICBnZXQgZXhwYW5kU2VsZWN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcy5leHBhbmRTZWxlY3Rpb247XG4gIH1cblxuICBzZXQgZXhwYW5kU2VsZWN0aW9uKHZhbHVlOiBib29sZWFuKSB7XG4gICAgdGhpcy5zZXQoXCJleHBhbmRTZWxlY3Rpb25cIiwgdmFsdWUpO1xuICB9XG5cbiAgZ2V0IGJldHRlckxpc3RzU3R5bGVzKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcy5zdHlsZUxpc3RzO1xuICB9XG5cbiAgc2V0IGJldHRlckxpc3RzU3R5bGVzKHZhbHVlOiBib29sZWFuKSB7XG4gICAgdGhpcy5zZXQoXCJzdHlsZUxpc3RzXCIsIHZhbHVlKTtcbiAgfVxuXG4gIGdldCB2ZXJ0aWNhbExpbmVzKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcy5saXN0TGluZXM7XG4gIH1cblxuICBzZXQgdmVydGljYWxMaW5lcyh2YWx1ZTogYm9vbGVhbikge1xuICAgIHRoaXMuc2V0KFwibGlzdExpbmVzXCIsIHZhbHVlKTtcbiAgfVxuXG4gIGdldCB2ZXJ0aWNhbExpbmVzQWN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcy5saXN0TGluZUFjdGlvbjtcbiAgfVxuXG4gIHNldCB2ZXJ0aWNhbExpbmVzQWN0aW9uKHZhbHVlOiBWZXJ0aWNhbExpbmVzQWN0aW9uKSB7XG4gICAgdGhpcy5zZXQoXCJsaXN0TGluZUFjdGlvblwiLCB2YWx1ZSk7XG4gIH1cblxuICBnZXQgZHJhZ0FuZERyb3AoKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVzLmRuZDtcbiAgfVxuXG4gIHNldCBkcmFnQW5kRHJvcCh2YWx1ZTogYm9vbGVhbikge1xuICAgIHRoaXMuc2V0KFwiZG5kXCIsIHZhbHVlKTtcbiAgfVxuXG4gIGdldCBkZWJ1ZygpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMuZGVidWc7XG4gIH1cblxuICBzZXQgZGVidWcodmFsdWU6IGJvb2xlYW4pIHtcbiAgICB0aGlzLnNldChcImRlYnVnXCIsIHZhbHVlKTtcbiAgfVxuXG4gIGdldCBwcmV2aW91c1JlbGVhc2UoKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVzLnByZXZpb3VzUmVsZWFzZTtcbiAgfVxuXG4gIHNldCBwcmV2aW91c1JlbGVhc2UodmFsdWU6IHN0cmluZyB8IG51bGwpIHtcbiAgICB0aGlzLnNldChcInByZXZpb3VzUmVsZWFzZVwiLCB2YWx1ZSk7XG4gIH1cblxuICBvbkNoYW5nZShjYjogQ2FsbGJhY2spIHtcbiAgICB0aGlzLmNhbGxiYWNrcy5hZGQoY2IpO1xuICB9XG5cbiAgcmVtb3ZlQ2FsbGJhY2soY2I6IENhbGxiYWNrKTogdm9pZCB7XG4gICAgdGhpcy5jYWxsYmFja3MuZGVsZXRlKGNiKTtcbiAgfVxuXG4gIHJlc2V0KCkge1xuICAgIGZvciAoY29uc3QgW2ssIHZdIG9mIE9iamVjdC5lbnRyaWVzKERFRkFVTFRfU0VUVElOR1MpKSB7XG4gICAgICB0aGlzLnNldChrIGFzIGtleW9mIFNldHRpbmdzT2JqZWN0LCB2KTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMudmFsdWVzID0gT2JqZWN0LmFzc2lnbihcbiAgICAgIHt9LFxuICAgICAgREVGQVVMVF9TRVRUSU5HUyxcbiAgICAgIGF3YWl0IHRoaXMuc3RvcmFnZS5sb2FkRGF0YSgpLFxuICAgICk7XG4gIH1cblxuICBhc3luYyBzYXZlKCkge1xuICAgIGF3YWl0IHRoaXMuc3RvcmFnZS5zYXZlRGF0YSh0aGlzLnZhbHVlcyk7XG4gIH1cblxuICBnZXRWYWx1ZXMoKTogU2V0dGluZ3NPYmplY3Qge1xuICAgIHJldHVybiB7IC4uLnRoaXMudmFsdWVzIH07XG4gIH1cblxuICBwcml2YXRlIHNldDxUIGV4dGVuZHMga2V5b2YgU2V0dGluZ3NPYmplY3Q+KFxuICAgIGtleTogVCxcbiAgICB2YWx1ZTogU2V0dGluZ3NPYmplY3RbVF0sXG4gICk6IHZvaWQge1xuICAgIHRoaXMudmFsdWVzW2tleV0gPSB2YWx1ZTtcblxuICAgIGZvciAoY29uc3QgY2Igb2YgdGhpcy5jYWxsYmFja3MpIHtcbiAgICAgIGNiKCk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgQXJyb3dMZWZ0QW5kQ3RybEFycm93TGVmdEJlaGF2aW91ck92ZXJyaWRlIH0gZnJvbSBcIi4vZmVhdHVyZXMvQXJyb3dMZWZ0QW5kQ3RybEFycm93TGVmdEJlaGF2aW91ck92ZXJyaWRlXCI7XG5pbXBvcnQgeyBCYWNrc3BhY2VCZWhhdmlvdXJPdmVycmlkZSB9IGZyb20gXCIuL2ZlYXR1cmVzL0JhY2tzcGFjZUJlaGF2aW91ck92ZXJyaWRlXCI7XG5pbXBvcnQgeyBCZXR0ZXJMaXN0c1N0eWxlcyB9IGZyb20gXCIuL2ZlYXR1cmVzL0JldHRlckxpc3RzU3R5bGVzXCI7XG5pbXBvcnQgeyBDdHJsQUFuZENtZEFCZWhhdmlvdXJPdmVycmlkZSB9IGZyb20gXCIuL2ZlYXR1cmVzL0N0cmxBQW5kQ21kQUJlaGF2aW91ck92ZXJyaWRlXCI7XG5pbXBvcnQgeyBEZWxldGVCZWhhdmlvdXJPdmVycmlkZSB9IGZyb20gXCIuL2ZlYXR1cmVzL0RlbGV0ZUJlaGF2aW91ck92ZXJyaWRlXCI7XG5pbXBvcnQgeyBEcmFnQW5kRHJvcCB9IGZyb20gXCIuL2ZlYXR1cmVzL0RyYWdBbmREcm9wXCI7XG5pbXBvcnQgeyBFZGl0b3JTZWxlY3Rpb25zQmVoYXZpb3VyT3ZlcnJpZGUgfSBmcm9tIFwiLi9mZWF0dXJlcy9FZGl0b3JTZWxlY3Rpb25zQmVoYXZpb3VyT3ZlcnJpZGVcIjtcbmltcG9ydCB7IEVudGVyQmVoYXZpb3VyT3ZlcnJpZGUgfSBmcm9tIFwiLi9mZWF0dXJlcy9FbnRlckJlaGF2aW91ck92ZXJyaWRlXCI7XG5pbXBvcnQgeyBGZWF0dXJlIH0gZnJvbSBcIi4vZmVhdHVyZXMvRmVhdHVyZVwiO1xuaW1wb3J0IHsgTGlzdHNGb2xkaW5nQ29tbWFuZHMgfSBmcm9tIFwiLi9mZWF0dXJlcy9MaXN0c0ZvbGRpbmdDb21tYW5kc1wiO1xuaW1wb3J0IHsgTGlzdHNNb3ZlbWVudENvbW1hbmRzIH0gZnJvbSBcIi4vZmVhdHVyZXMvTGlzdHNNb3ZlbWVudENvbW1hbmRzXCI7XG5pbXBvcnQgeyBNZXRhQmFja3NwYWNlQmVoYXZpb3VyT3ZlcnJpZGUgfSBmcm9tIFwiLi9mZWF0dXJlcy9NZXRhQmFja3NwYWNlQmVoYXZpb3VyT3ZlcnJpZGVcIjtcbi8vIGltcG9ydCB7IFJlbGVhc2VOb3Rlc0Fubm91bmNlbWVudCB9IGZyb20gXCIuL2ZlYXR1cmVzL1JlbGVhc2VOb3Rlc0Fubm91bmNlbWVudFwiO1xuaW1wb3J0IHsgU2V0dGluZ3NUYWIgfSBmcm9tIFwiLi9mZWF0dXJlcy9TZXR0aW5nc1RhYlwiO1xuaW1wb3J0IHsgU2hpZnRUYWJCZWhhdmlvdXJPdmVycmlkZSB9IGZyb20gXCIuL2ZlYXR1cmVzL1NoaWZ0VGFiQmVoYXZpb3VyT3ZlcnJpZGVcIjtcbmltcG9ydCB7IFN5c3RlbUluZm8gfSBmcm9tIFwiLi9mZWF0dXJlcy9TeXN0ZW1JbmZvXCI7XG5pbXBvcnQgeyBUYWJCZWhhdmlvdXJPdmVycmlkZSB9IGZyb20gXCIuL2ZlYXR1cmVzL1RhYkJlaGF2aW91ck92ZXJyaWRlXCI7XG5pbXBvcnQgeyBWZXJ0aWNhbExpbmVzIH0gZnJvbSBcIi4vZmVhdHVyZXMvVmVydGljYWxMaW5lc1wiO1xuaW1wb3J0IHsgVmltT0JlaGF2aW91ck92ZXJyaWRlIH0gZnJvbSBcIi4vZmVhdHVyZXMvVmltT0JlaGF2aW91ck92ZXJyaWRlXCI7XG5pbXBvcnQgeyBDaGFuZ2VzQXBwbGljYXRvciB9IGZyb20gXCIuL3NlcnZpY2VzL0NoYW5nZXNBcHBsaWNhdG9yXCI7XG5pbXBvcnQgeyBJTUVEZXRlY3RvciB9IGZyb20gXCIuL3NlcnZpY2VzL0lNRURldGVjdG9yXCI7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tIFwiLi9zZXJ2aWNlcy9Mb2dnZXJcIjtcbmltcG9ydCB7IE9ic2lkaWFuU2V0dGluZ3MgfSBmcm9tIFwiLi9zZXJ2aWNlcy9PYnNpZGlhblNldHRpbmdzXCI7XG5pbXBvcnQgeyBPcGVyYXRpb25QZXJmb3JtZXIgfSBmcm9tIFwiLi9zZXJ2aWNlcy9PcGVyYXRpb25QZXJmb3JtZXJcIjtcbmltcG9ydCB7IFBhcnNlciB9IGZyb20gXCIuL3NlcnZpY2VzL1BhcnNlclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi9zZXJ2aWNlcy9TZXR0aW5nc1wiO1xuXG5kZWNsYXJlIGdsb2JhbCB7XG4gIGNvbnN0IFBMVUdJTl9WRVJTSU9OOiBzdHJpbmc7XG4gIGNvbnN0IENIQU5HRUxPR19NRDogc3RyaW5nO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBPYnNpZGlhbk91dGxpbmVyUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgcHJpdmF0ZSBmZWF0dXJlczogRmVhdHVyZVtdO1xuICBzZXR0aW5nczogU2V0dGluZ3M7XG4gIHByaXZhdGUgbG9nZ2VyOiBMb2dnZXI7XG4gIHByaXZhdGUgb2JzaWRpYW5TZXR0aW5nczogT2JzaWRpYW5TZXR0aW5ncztcbiAgcHJpdmF0ZSBwYXJzZXI6IFBhcnNlcjtcbiAgcHJpdmF0ZSBjaGFuZ2VzQXBwbGljYXRvcjogQ2hhbmdlc0FwcGxpY2F0b3I7XG4gIHByaXZhdGUgb3BlcmF0aW9uUGVyZm9ybWVyOiBPcGVyYXRpb25QZXJmb3JtZXI7XG4gIHByaXZhdGUgaW1lRGV0ZWN0b3I6IElNRURldGVjdG9yO1xuXG4gIGFzeW5jIG9ubG9hZCgpIHtcbiAgICBjb25zb2xlLmxvZyhgTG9hZGluZyBvYnNpZGlhbi1vdXRsaW5lcmApO1xuXG4gICAgYXdhaXQgdGhpcy5wcmVwYXJlU2V0dGluZ3MoKTtcblxuICAgIHRoaXMub2JzaWRpYW5TZXR0aW5ncyA9IG5ldyBPYnNpZGlhblNldHRpbmdzKHRoaXMuYXBwKTtcbiAgICB0aGlzLmxvZ2dlciA9IG5ldyBMb2dnZXIodGhpcy5zZXR0aW5ncyk7XG4gICAgdGhpcy5wYXJzZXIgPSBuZXcgUGFyc2VyKHRoaXMubG9nZ2VyLCB0aGlzLnNldHRpbmdzKTtcbiAgICB0aGlzLmNoYW5nZXNBcHBsaWNhdG9yID0gbmV3IENoYW5nZXNBcHBsaWNhdG9yKCk7XG4gICAgdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIgPSBuZXcgT3BlcmF0aW9uUGVyZm9ybWVyKFxuICAgICAgdGhpcy5wYXJzZXIsXG4gICAgICB0aGlzLmNoYW5nZXNBcHBsaWNhdG9yLFxuICAgICk7XG5cbiAgICB0aGlzLmltZURldGVjdG9yID0gbmV3IElNRURldGVjdG9yKCk7XG4gICAgYXdhaXQgdGhpcy5pbWVEZXRlY3Rvci5sb2FkKCk7XG5cbiAgICB0aGlzLmZlYXR1cmVzID0gW1xuICAgICAgLy8gc2VydmljZSBmZWF0dXJlc1xuICAgICAgLy8gbmV3IFJlbGVhc2VOb3Rlc0Fubm91bmNlbWVudCh0aGlzLCB0aGlzLnNldHRpbmdzKSxcbiAgICAgIG5ldyBTZXR0aW5nc1RhYih0aGlzLCB0aGlzLnNldHRpbmdzKSxcbiAgICAgIG5ldyBTeXN0ZW1JbmZvKHRoaXMsIHRoaXMuc2V0dGluZ3MpLFxuXG4gICAgICAvLyBnZW5lcmFsIGZlYXR1cmVzXG4gICAgICBuZXcgTGlzdHNNb3ZlbWVudENvbW1hbmRzKFxuICAgICAgICB0aGlzLFxuICAgICAgICB0aGlzLm9ic2lkaWFuU2V0dGluZ3MsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcbiAgICAgIG5ldyBMaXN0c0ZvbGRpbmdDb21tYW5kcyh0aGlzLCB0aGlzLm9ic2lkaWFuU2V0dGluZ3MpLFxuXG4gICAgICAvLyBmZWF0dXJlcyBiYXNlZCBvbiBzZXR0aW5ncy5rZWVwQ3Vyc29yV2l0aGluQ29udGVudFxuICAgICAgbmV3IEVkaXRvclNlbGVjdGlvbnNCZWhhdmlvdXJPdmVycmlkZShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgdGhpcy5wYXJzZXIsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcbiAgICAgIG5ldyBBcnJvd0xlZnRBbmRDdHJsQXJyb3dMZWZ0QmVoYXZpb3VyT3ZlcnJpZGUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgIHRoaXMuaW1lRGV0ZWN0b3IsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcbiAgICAgIG5ldyBCYWNrc3BhY2VCZWhhdmlvdXJPdmVycmlkZShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgdGhpcy5pbWVEZXRlY3RvcixcbiAgICAgICAgdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIsXG4gICAgICApLFxuICAgICAgbmV3IE1ldGFCYWNrc3BhY2VCZWhhdmlvdXJPdmVycmlkZShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgdGhpcy5pbWVEZXRlY3RvcixcbiAgICAgICAgdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIsXG4gICAgICApLFxuICAgICAgbmV3IERlbGV0ZUJlaGF2aW91ck92ZXJyaWRlKFxuICAgICAgICB0aGlzLFxuICAgICAgICB0aGlzLnNldHRpbmdzLFxuICAgICAgICB0aGlzLmltZURldGVjdG9yLFxuICAgICAgICB0aGlzLm9wZXJhdGlvblBlcmZvcm1lcixcbiAgICAgICksXG5cbiAgICAgIC8vIGZlYXR1cmVzIGJhc2VkIG9uIHNldHRpbmdzLm92ZXJyaWRlVGFiQmVoYXZpb3VyXG4gICAgICBuZXcgVGFiQmVoYXZpb3VyT3ZlcnJpZGUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuaW1lRGV0ZWN0b3IsXG4gICAgICAgIHRoaXMub2JzaWRpYW5TZXR0aW5ncyxcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIsXG4gICAgICApLFxuICAgICAgbmV3IFNoaWZ0VGFiQmVoYXZpb3VyT3ZlcnJpZGUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuaW1lRGV0ZWN0b3IsXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcblxuICAgICAgLy8gZmVhdHVyZXMgYmFzZWQgb24gc2V0dGluZ3Mub3ZlcnJpZGVFbnRlckJlaGF2aW91clxuICAgICAgbmV3IEVudGVyQmVoYXZpb3VyT3ZlcnJpZGUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgIHRoaXMuaW1lRGV0ZWN0b3IsXG4gICAgICAgIHRoaXMub2JzaWRpYW5TZXR0aW5ncyxcbiAgICAgICAgdGhpcy5wYXJzZXIsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcblxuICAgICAgLy8gZmVhdHVyZXMgYmFzZWQgb24gc2V0dGluZ3Mub3ZlcnJpZGVWaW1PQmVoYXZpb3VyXG4gICAgICBuZXcgVmltT0JlaGF2aW91ck92ZXJyaWRlKFxuICAgICAgICB0aGlzLFxuICAgICAgICB0aGlzLnNldHRpbmdzLFxuICAgICAgICB0aGlzLm9ic2lkaWFuU2V0dGluZ3MsXG4gICAgICAgIHRoaXMucGFyc2VyLFxuICAgICAgICB0aGlzLm9wZXJhdGlvblBlcmZvcm1lcixcbiAgICAgICksXG5cbiAgICAgIC8vIGZlYXR1cmVzIGJhc2VkIG9uIHNldHRpbmdzLm92ZXJyaWRlU2VsZWN0QWxsQmVoYXZpb3VyXG4gICAgICBuZXcgQ3RybEFBbmRDbWRBQmVoYXZpb3VyT3ZlcnJpZGUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgIHRoaXMuaW1lRGV0ZWN0b3IsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcblxuICAgICAgLy8gZmVhdHVyZXMgYmFzZWQgb24gc2V0dGluZ3MuYmV0dGVyTGlzdHNTdHlsZXNcbiAgICAgIG5ldyBCZXR0ZXJMaXN0c1N0eWxlcyh0aGlzLnNldHRpbmdzLCB0aGlzLm9ic2lkaWFuU2V0dGluZ3MpLFxuXG4gICAgICAvLyBmZWF0dXJlcyBiYXNlZCBvbiBzZXR0aW5ncy52ZXJ0aWNhbExpbmVzXG4gICAgICBuZXcgVmVydGljYWxMaW5lcyhcbiAgICAgICAgdGhpcyxcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgdGhpcy5vYnNpZGlhblNldHRpbmdzLFxuICAgICAgICB0aGlzLnBhcnNlcixcbiAgICAgICksXG5cbiAgICAgIC8vIGZlYXR1cmVzIGJhc2VkIG9uIHNldHRpbmdzLmRyYWdBbmREcm9wXG4gICAgICBuZXcgRHJhZ0FuZERyb3AoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgIHRoaXMub2JzaWRpYW5TZXR0aW5ncyxcbiAgICAgICAgdGhpcy5wYXJzZXIsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcbiAgICBdO1xuXG4gICAgZm9yIChjb25zdCBmZWF0dXJlIG9mIHRoaXMuZmVhdHVyZXMpIHtcbiAgICAgIGF3YWl0IGZlYXR1cmUubG9hZCgpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIG9udW5sb2FkKCkge1xuICAgIGNvbnNvbGUubG9nKGBVbmxvYWRpbmcgb2JzaWRpYW4tb3V0bGluZXJgKTtcblxuICAgIGF3YWl0IHRoaXMuaW1lRGV0ZWN0b3IudW5sb2FkKCk7XG5cbiAgICBmb3IgKGNvbnN0IGZlYXR1cmUgb2YgdGhpcy5mZWF0dXJlcykge1xuICAgICAgYXdhaXQgZmVhdHVyZS51bmxvYWQoKTtcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgcHJlcGFyZVNldHRpbmdzKCkge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBuZXcgU2V0dGluZ3ModGhpcyk7XG4gICAgYXdhaXQgdGhpcy5zZXR0aW5ncy5sb2FkKCk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJlZGl0b3JJbmZvRmllbGQiLCJmb2xkZWRSYW5nZXMiLCJmb2xkYWJsZSIsImZvbGRFZmZlY3QiLCJ1bmZvbGRFZmZlY3QiLCJydW5TY29wZUhhbmRsZXJzIiwia2V5bWFwIiwiTm90aWNlIiwiaW5kZW50U3RyaW5nIiwiZ2V0SW5kZW50VW5pdCIsIlN0YXRlRWZmZWN0IiwiRGVjb3JhdGlvbiIsIlN0YXRlRmllbGQiLCJFZGl0b3JWaWV3IiwiUGxhdGZvcm0iLCJFZGl0b3JTdGF0ZSIsIlByZWMiLCJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyIsIk1vZGFsIiwiVmlld1BsdWdpbiIsIk1hcmtkb3duVmlldyIsIlBsdWdpbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBa0dBO0FBQ08sU0FBUyxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFO0FBQzdELElBQUksU0FBUyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsT0FBTyxLQUFLLFlBQVksQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxVQUFVLE9BQU8sRUFBRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoSCxJQUFJLE9BQU8s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QWEsQ0FBQyxNQUFjLEVBQUE7QUFDMUIsUUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU07SUFDdEI7SUFFQSxTQUFTLEdBQUE7UUFDUCxPQUFPLElBQUksQ0FBQyxNQUFNO0lBQ3BCO0FBRUEsSUFBQSxZQUFZLENBQUMsSUFBVSxFQUFBO0FBQ3JCLFFBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO0FBQzNCLFFBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJO0lBQ3BCO0FBRUEsSUFBQSxXQUFXLENBQUMsSUFBVSxFQUFBO0FBQ3BCLFFBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQ3hCLFFBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJO0lBQ3BCO0FBRUEsSUFBQSxXQUFXLENBQUMsSUFBVSxFQUFBO1FBQ3BCLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztRQUNyQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzFCLFFBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJO0lBQ3BCO0lBRUEsU0FBUyxDQUFDLE1BQVksRUFBRSxJQUFVLEVBQUE7UUFDaEMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDO0FBQ2hDLFFBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJO0lBQ3BCO0lBRUEsUUFBUSxDQUFDLE1BQVksRUFBRSxJQUFVLEVBQUE7UUFDL0IsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO0FBQ3ZDLFFBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFB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LEVBQ0osSUFBSSxDQUFDLFFBQVEsRUFDYixJQUFJLENBQUMsV0FBVyxFQUNoQixJQUFJLENBQUMsZ0JBQWdCLEVBQ3JCLElBQUksQ0FBQyxNQUFNLEVBQ1gsSUFBSSxDQUFDLGtCQUFrQixDQUN4Qjs7QUFHRCxnQkFBQSxJQUFJLHFCQUFxQixDQUN2QixJQUFJLEVBQ0osSUFBSSxDQUFDLFFBQVEsRUFDYixJQUFJLENBQUMsZ0JBQWdCLEVBQ3JCLElBQUksQ0FBQyxNQUFNLEVBQ1gsSUFBSSxDQUFDLGtCQUFrQixDQUN4Qjs7QUFHRCxnQkFBQSxJQUFJLDZCQUE2QixDQUMvQixJQUFJLEVBQ0osSUFBSSxDQUFDLFFBQVEsRUFDYixJQUFJLENBQUMsV0FBVyxFQUNoQixJQUFJLENBQUMsa0JBQWtCLENBQ3hCOztnQkFHRCxJQUFJLGlCQUFpQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDOztBQUczRCxnQkFBQSxJQUFJLGFBQWEsQ0FDZixJQUFJLEVBQ0osSUFBSSxDQUFDLFFBQVEsRUFDYixJQUFJLENBQUMsZ0JBQWdCLEVBQ3JCLElBQUksQ0FBQyxNQUFNLENBQ1o7O0FBR0QsZ0JBQUEsSUFBSSxXQUFXLENBQ2IsSUFBSSxFQUNKLElBQUksQ0FBQyxRQUFRLEVBQ2IsSUFBSSxDQUFDLGdCQUFnQixFQUNyQixJQUFJLENBQUMsTUFBTSxFQUNYLElBQUksQ0FBQyxrQkFBa0IsQ0FDeEI7YUFDRjtBQUVELFlBQUEsS0FBSyxNQUFNLE9BQU8sSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFO0FBQ25DLGdCQUFBLE1BQU0sT0FBTyxDQUFDLElBQUksRUFBRTtZQUN0QjtRQUNGLENBQUMsQ0FBQTtBQUFBLElBQUE7SUFFSyxRQUFRLEdBQUE7O0FBQ1osWUFBQSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUEsMkJBQUEsQ0FBNkIsQ0FBQztBQUUxQyxZQUFBLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUU7QUFFL0IsWUFBQSxLQUFLLE1BQU0sT0FBTyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUU7QUFDbkMsZ0JBQUEsTUFBTSxPQUFPLENBQUMsTUFBTSxFQUFFO1lBQ3hCO1FBQ0YsQ0FBQyxDQUFBO0FBQUEsSUFBQTtJQUVlLGVBQWUsR0FBQTs7WUFDN0IsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUM7QUFDbEMsWUFBQSxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFO1FBQzVCLENBQUMsQ0FBQTtBQUFBLElBQUE7QUFDRjs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzBdfQ==
