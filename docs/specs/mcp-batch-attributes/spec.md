---
title: mcp-batch-attributes - edit Attributes, delete Diagrams, export the Project and batch operations over MCP
tags: [spec, mcp]
date: 2026-11-23
status: done
---

# mcp-batch-attributes

Vocabulary: [GLOSSARY](../../../GLOSSARY.md) (Attribute, Diagram, MCD, Shared Project). MCP server: [mcp-server](../mcp-server/spec.md).

## Problem Statement

An agent editing an MCD over MCP cannot change an Attribute once it is added: to fix a type, an Identifier, a NULL or a name it deletes the Entity and adds it again, losing its Legs and its place. It cannot remove an Attribute or a whole Diagram either, cannot take a copy of the Project as the app's JSON export, and pays one round trip and one live update per change when it builds a Diagram of fifty elements, a failure halfway leaving it half built.

## Solution

Five new MCP tools:

- `set_attribute`: changes an Attribute of an Entity or an Association (name, type, Identifier, NULL, position in the list), found by id or exact name.
- `remove_attribute`: removes an Attribute.
- `delete_diagram`: deletes a Diagram of the Project, by id or exact name.
- `export_project`: the Project as the same JSON file as the app's "Project (JSON)" export.
- `batch`: a list of write operations (`{ tool, args }`) played all or nothing in one transaction. An operation refers to an element created earlier in the batch with `{ "$ref": N }`, the id returned by operation N (from 1).

## User Stories

1. As an agent, I want to change an Attribute's type, so that I fix `text` into `decimal(10,2)` without recreating the Entity.
2. As an agent, I want to rename an Attribute, so that it follows the naming the user asks for.
3. As an agent, I want to make an Attribute part of the Identifier or not, so that I fix the key of an Entity.
4. As an agent, I want to let a column accept NULL or not, so that the SQL matches the rules.
5. As an agent, I want to move an Attribute to a given position, so that the Identifier comes first.
6. As an agent, I want to remove an Attribute, so that a column that does not belong goes away.
7. As an agent, I want to refer to an Attribute by its exact name, so that I need not read its id first.
8. As an agent, I want a clear error when the Attribute or the element is unknown, listing the known ones, so that I correct my call.
9. As an agent, I want to delete a Diagram, so that I remove a draft I made.
10. As an agent, I want the Project's JSON, so that I keep a copy the user can import back.
11. As an agent, I want to send many operations in one call, so that a Diagram builds in one round trip.
12. As an agent, I want a batch to apply nothing when one operation fails, so that I never leave a half-built Diagram.
13. As an agent, I want the error to name the failing operation and say why, so that I fix it and send again.
14. As an agent, I want to use in a later operation the id of an element created earlier in the batch, so that I add an Entity then its Association in one call.
15. As an agent, I want each operation's result back, so that I know the ids that were created.
16. As a Participant with the Project open, I want a batch to arrive as one change, so that I do not see the Diagram flicker through fifty states.

## Implementation Decisions

- `set_attribute` takes `project`, `diagram` (MCD), `element` (Entity or Association), `attribute` (id or exact name within that element), and optional `name`, `type`, `identifier`, `optional`, `position` (1-based, clamped to the list). It goes through the Project document's existing Attribute operations, so the same rules hold as in the app: an Identifier is never optional, a type that cannot be NULL clears `optional`, only an Entity has an Identifier (an error otherwise). Asking for NULL on an Identifier or a serial Attribute is an error rather than quietly ignored. It returns the Attribute's id. Moving to a position needs one new Project document operation (moving an Attribute to an index); the app keeps its one-step move.
- `remove_attribute` takes the same `element` and `attribute`, returns `{ deleted: id }`.
- `delete_diagram` takes `project` and `diagram`, returns `{ deleted: id }`. Deleting the last Diagram is allowed: the app already shows a Project without Diagrams.
- `export_project` takes `project` and returns the Project document's `toFile()`, the file the app exports and imports.
- `batch` takes `project` and `operations` (1 to 200 `{ tool, args }`). `tool` is any write tool (not `batch`, not the read tools); `args` are that tool's arguments without `project`, validated by the same schema. Before an operation runs, any `{ "$ref": N }` in its arguments, at any depth, is replaced by the `id` of operation N's result; a reference to a later operation, or to one whose result has no `id`, fails the batch. An explicit object rather than a `"$N"` string, so that a name or a Note text reading `$1` stays text.
- All or nothing: the operations run on a copy of the Shared Project's document; only when all succeed is the difference applied to the real document, in one transaction that open browsers receive as one update. On failure the error reads `Operation N (tool): <message>` and nothing changes. The size check applies before the batch, as for any write, and again to the size the batch would reach: a batch that would pass the limit is refused whole.
- The write tools are registered once against a project access; the batch registers them a second time against an access that runs every change on its copy, so each tool's code is the same in and out of a batch.

## Testing Decisions

- Tests go through the MCP endpoint, as in the existing MCP tests: call the tools with a client, check what a Participant's document holds and what the tool answers. No test of internals.
- `set_attribute`: each field, by id and by name, the Identifier and NULL rules, an Identifier on an Association refused, unknown element and Attribute errors, position at both ends and beyond.
- `remove_attribute`, `delete_diagram`: removed, unknown refused.
- `export_project`: the answer is the same file the document gives, and imports back.
- `batch`: a Diagram, Entities and an Association built with `$ref`; text reading `$1` kept; a batch past the size limit refused whole; a failing operation leaves the document unchanged and names the operation; a forward or bad `$ref` refused; `batch` inside `batch` and read tools refused; a browser receives one update.
- The tool list test grows by the five tools.

## Out of Scope

Kept in BACKLOG.md, since the app has none of them yet:

- UNIQUE and CHECK constraints set on Attributes (the SQL only derives them now).
- Naming foreign keys.
- Duplicating a Diagram.
- SQL comments (COMMENT ON); first noted here as comments on elements, a misreading.

## Further Notes

`export_diagram` (SVG, Merise or UML) and `get_mcd_sql` (MLD and PostgreSQL) already cover exporting an MCD as an image or SQL; PNG stays in BACKLOG.md.
