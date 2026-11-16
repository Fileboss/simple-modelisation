---
title: Glossary
tags: [glossary]
date: 2026-11-16
---

# simple-modelisation

A lightweight, collaborative web app where developers draw system architectures and database models.

## Workspace

**Project**:
The unit people open, share and collaborate on; it holds any number of Diagrams.
_Avoid_: Workspace, file, document

**Shared Project**:
A Project its owner chose to share: it syncs with the server and anyone holding its Share link can edit it.
_Avoid_: Public project, online project

**Local Project**:
A Project that exists only in this browser; nothing of it leaves the device.
_Avoid_: Private project, offline project

**Share link**:
The URL that opens a Shared Project; holding it is what grants edit access.
_Avoid_: Invite, public URL

**Participant**:
A person currently connected to a Shared Project, known by a display name and a color chosen in their browser.
_Avoid_: User, member, collaborator, account

**Presence**:
What a Participant shows others while connected: the Diagram they are on, their cursor and their selection; it is never stored.
_Avoid_: Status, activity

**Diagram**:
One canvas inside a Project, of exactly one kind: System design diagram or MCD.
_Avoid_: View, board, page, sheet

## System design

**System design diagram**:
A Diagram of Components joined by Connections, describing the architecture of a system.
_Avoid_: Architecture diagram, infra diagram

**Component**:
A box on a System design diagram standing for one part of the system; it has a Component type and optionally a Skin.
_Avoid_: Node, block, service (a Service is one Component type)

**Component type**:
The generic role of a Component: Client, Service, Database, Cache, Message queue, Gateway or Object storage.
_Avoid_: Category, kind

**Skin**:
A market product applied to a Component (PostgreSQL on a Database, Redis on a Cache), changing its logo, color and displayed name but not its Component type.
_Avoid_: Theme, technology, vendor

**Connection**:
A directed arrow between two Components, with an optional label such as the protocol.
_Avoid_: Link, edge, flow

## Data modeling (Merise)

**MCD**:
A Diagram holding a Merise conceptual data model: Entities joined by Associations.
_Avoid_: ERD, schema, database diagram

**Entity**:
A thing the data model records, drawn as a box listing its Attributes.
_Avoid_: Table, class

**Attribute**:
A named property of an Entity or an Association.
_Avoid_: Field, column

**Data type**:
The conceptual type of an Attribute (Integer, Text, Date, Auto-increment…), independent of any database; each SQL target translates it.
_Avoid_: Column type, SQL type

**Identifier**:
The Attribute(s) that uniquely identify an Entity, shown underlined.
_Avoid_: Primary key, ID

**Association**:
A named relationship between Entities, possibly reflexive and possibly carrying Attributes.
_Avoid_: Relation, relationship, link

**Leg**:
The line joining an Association to one of its Entities, labelled with a Cardinality.
_Avoid_: Link, edge, branch

**Cardinality**:
The min,max count on a Leg: one of 0,1 / 1,1 / 0,n / 1,n.
_Avoid_: Multiplicity (the UML Notation's word for it)

**MLD**:
The relational model derived from an MCD: its tables, their columns, primary keys and foreign keys, written in Looping's textual notation.
_Avoid_: Schema, physical model, ERD

**Notation**:
The visual convention an MCD is rendered in: Merise (Looping style) or UML class diagram; the model is the same.
_Avoid_: Style, mode
