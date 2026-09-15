# Credits Module

This folder contains the credits feature split into screen, components, hooks, services, and styles.

- `screens/CreditsScreen.jsx`: screen entry point
- `components/*`: UI pieces
- `hooks/useCredits.js`: state + actions
- `services/creditsService.js`: business logic — orchestrates transactions (abonar/crear/eliminar), calling validation + repository
- `services/creditsValidation.js`: pure guards/normalizers (id sanitizing, state asserts, revert-status lookup)
- `services/creditsRepository.js`: Firestore reads — realtime list, server-side aggregates
- `styles/creditsStyles.js`: module styles

