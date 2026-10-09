# Tasks

## 1. Protocol answers

- [x] 1.1 Add `RPC_REJECTIONS` to `src/shared/rpc/constants.ts` and derive `RpcRejection` from it.
- [x] 1.2 Add `src/shared/rpc/schemas.ts` with `rpcResponseSchemas` (`rpc.refused`, `rpc.failed`) and export it from the barrel.
- [x] 1.3 In `src/app/backgroundApp`, answer an unparseable message with `rpc.refused`, an unhandled failure with `rpc.failed`, and give `inference.probe` its own `inference.failed`.
- [x] 1.4 Admit `rpcResponseSchemas` in `OptionsApp` and fold both answers into `problem` in `reduceOptionsState`.
- [x] 1.5 Specs: refusal by type, by envelope, by payload; unexpected failure; reducer cases; the surface shows a refusal.

## 2. Activation

- [x] 2.1 Record the activated model and deactivate its siblings in one `readwrite` transaction in `activateModel`; verify the existing activation specs pass.

## 3. Error messages

- [x] 3.1 Add `src/shared/getErrorMessage` with a spec, and use it at all eight sites.

## 4. Verification

- [x] 4.1 `npm run verify` passes (typecheck, lint, format, unit, offline e2e).
- [x] 4.2 Remove the fixed items from the known-deviation lists in `docs/codeGuide/`.
