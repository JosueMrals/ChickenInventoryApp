# Product

## Register

product

## Users

Staff of a chicken distribution business, split across four roles with distinct contexts:
- **Admin**: office/desk use, longer focused sessions reviewing reports, users, and overall state.
- **Vendedor / Bodeguero**: warehouse or counter use — inventory, presales, quick sales, focused data-entry sessions.
- **Entregador**: field use on delivery routes — often one-handed, on the move, needs fast legible screens (tickets, route status) over polish.

The job to be done varies by screen: recording inventory movements, closing sales, managing delivery routes, printing tickets, tracking credits/returns. Firestore keeps everyone's view in sync in real time, so screens must stay legible and fast whether the user just glanced at the phone mid-route or is doing a 20-minute warehouse reconciliation.

## Product Purpose

An Android-only React Native app that runs the day-to-day operations of a chicken distribution business: inventory, presales, quick sales, delivery routes, credits/returns, customer management, and reporting. Firebase (Auth, Firestore, Storage, Crashlytics, Functions, App Check) is the backend. Success looks like: staff can complete their role's task (log a sale, print a ticket, close a route, restock inventory) quickly and without confusion, across a mix of field and desk contexts.

## Brand Personality

Clean & trustworthy. Neutral, professional — clarity and reliability over decoration. This is a tool people rely on to get paid and keep stock straight; it should read as dependable and unfussy, not flashy.

## Anti-references

No specific anti-reference named. Avoid anything that trades clarity for decoration (unnecessary motion, low-contrast text, dense unlabeled icon rows) given the mixed field/desk usage.

## Design Principles

- **Legible over decorative** — this is a working tool for staff getting paid by the transaction; clarity wins over visual flourish.
- **One-handed field use is a real constraint** — entregadores use this on delivery routes, not just at a desk; touch targets and hierarchy must hold up there.
- **Real-time state must read as trustworthy** — Firestore sync means the screen can change under the user; state changes (loading, stale, error) should never look ambiguous.
- **Role-appropriate density** — admin/bodeguero desk screens can carry more information density than entregador field screens.
- **Consistency across modules** — each feature module (sales, presales, Warehouse, credits, routes, etc.) is self-contained but should feel like one app, not four.

## Accessibility & Inclusion

No specific WCAG level or named accommodation requested. Standard mobile accessibility bar: sufficient contrast, adequately sized tap targets, legible type sizes — particularly given entregadores may be viewing the screen outdoors or in variable light on delivery routes.
