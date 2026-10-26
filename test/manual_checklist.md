# Manual Test Checklist

## Menu Entry Ownership

- Confirm Rename Map, Export Map Markdown, and Delete Map appear when right-clicking a map item and do not appear in File, the left panel, or the right panel.
- Confirm Recycle Bin appears in File and no longer appears in the left panel.
- Confirm More contains Copy Node Markdown, Edit Node, Connect Node, Update Relation, Delete Node, and Restore Node without separate duplicate buttons in the right panel.

## Basic UI

- [ ] App starts.
- [ ] Map list is visible.
- [ ] Graph canvas is visible.
- [ ] Node Markdown panel is visible.
- [ ] Settings dialog opens.
- [ ] Template manager opens.

## Map And Node Flow

- [ ] Create a new map.
- [ ] Enter a concept.
- [ ] Generate a root node.
- [ ] Select a node on the canvas.
- [ ] Drag a node.
- [ ] Zoom the canvas.
- [ ] Select text inside Markdown.
- [ ] Create a linked child node from selected text.

## Markdown

- [ ] Copy selected node Markdown.
- [ ] Export whole map Markdown.
- [ ] Export handles repeated nodes without infinite recursion.

## Persistence

- [ ] Restart app.
- [ ] Maps are still listed.
- [ ] Nodes and edges are restored.
- [ ] Node positions are restored.
- [ ] Templates are restored.

## Language

- [ ] Chinese UI can be selected.
- [ ] English UI can be selected.
- [ ] Unicode map titles and concept titles render correctly.

## API

- [ ] Missing API key shows a clear error.
- [ ] Invalid API key shows a clear error.
- [ ] Responses mode builds a valid request.
- [ ] Chat Completions Compatible mode builds a valid request.
