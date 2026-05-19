# Abstract

Popular Consensus Protocol Replay Kit is an open-source Ethereum infrastructure project for verifiable civic governance records. It defines canonical event schemas, content-addressed artifacts, Ethereum anchoring contracts, and replay verification tools so communities can publish decisions that are privacy-aware, challengeable, archivable, exportable, and independently verifiable without trusting the application database.

The grant-facing work is the protocol layer, not the social platform. The protocol layer proves that a civic record can be rebuilt from public events and artifacts, checked for tampering, and exported for independent review.

## Current Proof Point

The repo now includes a production-slice verifier and a grant demo command:

```bash
pnpm grant:demo
```

The command writes a replay report to:

```text
artifacts/grant-demo/full-lifecycle-report.json
```

## What Other Builders Can Reuse

Other builders can reuse the artifact format, replay report shape, verifier package, and grant-demo transcript pattern for their own governance or public-record protocols.
