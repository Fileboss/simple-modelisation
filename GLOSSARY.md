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
The generic role of a Component: Client, Service, Database, Cache, Message queue, Gateway, Object storage or Disk.
_Avoid_: Category, kind

**Service** and **Client**:
Diagrams take the server's point of view. A Service is software the system runs, a web app included, even a front end; a Client is what the end user runs it in: a web browser, a phone, a desktop.
_Avoid_: Front end, back end (a front end served by Node.js is a Service)

**Person**:
A Component type for someone who uses or runs the system (a customer, an admin, a partner, support), drawn as a silhouette rather than a box; its Skins are roles. A Person has no Hosting, Provider or Runtime; the device or software it uses is a Client.
_Avoid_: User (also an account or a table), actor

**Disk**:
A Component type for physical storage attached to a machine (an HDD, an SSD, an NVMe drive, a USB disk), as opposed to Object storage reached over the network; its Disk kind says which.
_Avoid_: Volume, drive, storage (Object storage is another Component type)

**Skin**:
A product or a framework applied to a Component (PostgreSQL on a Database, Next.js or Vaultwarden on a Service, Android on a Client), changing its logo, color and displayed name but not its Component type.
_Avoid_: Theme, technology, vendor

**Runtime**:
What executes a Service's code on the server: Node.js, Bun, Java, .NET, Python, PHP, Ruby, or the language for a native binary (Go, Rust). Shown as the Service's logo when it has no Skin, else as a badge beside its Skin (Next.js on Bun).
_Avoid_: Language, platform, stack

**Hosting**:
Where a Component runs, from the most concrete to the most abstract: Bare metal, VM, Docker, Kubernetes, Managed, Serverless or External; shown as a badge on the Component.
_Avoid_: Infra type, deployment, environment

**Provider**:
Whose infrastructure a Component runs on: a company such as AWS, OVHcloud or Hetzner, or Self-hosted for one's own machines; shown as a badge beside the Hosting, which says how it runs there, except for an External service, which is its own provider. A Zone can have one too, which the Components inside it take unless they have their own.
_Avoid_: Cloud, vendor, host

**Zone**:
A named area of a System design diagram grouping the Components drawn inside it, such as a region, a VPC or a subnet; Zones can nest, and a Component belongs to the innermost Zone its box lies in.
_Avoid_: Group, container, boundary, cluster (a Kubernetes cluster is one thing a Zone can stand for)

**Note**:
Free text on a sticky note, placed anywhere on a Diagram to explain it (a schedule, a constraint), in one of five colors; not part of the system it describes: no Connections, left in place by Tidy up, ignored by the MLD.
_Avoid_: Comment (a remark on a document), annotation, label (a Connection's text)

**Connection**:
A directed arrow between two Components, from the one that initiates (the caller, the client) to the one it reaches, with an optional label such as the protocol and an optional Flow.
_Avoid_: Link, edge, flow (a Flow is what a Connection's data does)

**Flow**:
What a Connection's data does, seen from the initiator: Read (the data comes back), Write (the data goes to the target) or Read/Write; it colors the Connection and names it in its label.
_Avoid_: Direction (the arrow's direction is always who initiates), access, mode

**Legend**:
The key in an exported image of a System design diagram, naming the Flows, Providers, Hostings and Runtimes its marks stand for; only those the image shows.
_Avoid_: Key, caption

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
