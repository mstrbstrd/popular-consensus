import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildArtifactManifest,
  buildArtifactExportBundle,
  createFileArtifactStorage,
  hashArtifactManifest,
  hashJson,
  readArtifact,
  schemaVersionForArtifactKind,
  verifyArtifactManifest,
  verifyStoredArtifact,
  withArtifactSchema,
  writeArtifact
} from "./index";

describe("artifacts", () => {
  it("hashes canonically and reads stored artifacts", async () => {
    const first = hashJson({ b: 2, a: 1 });
    const second = hashJson({ a: 1, b: 2 });
    expect(first).toEqual(second);

    const dir = await mkdtemp(path.join(tmpdir(), "pc-artifacts-"));
    const stored = await writeArtifact(dir, { b: 2, a: 1 });
    expect(await readArtifact(dir, stored.hash)).toEqual({ b: 2, a: 1 });

    const dated = await writeArtifact(dir, { at: new Date("2026-05-08T00:00:00.000Z") });
    expect(await verifyStoredArtifact(dir, dated.hash)).toMatchObject({ valid: true, computedHash: dated.hash });
    await rm(dir, { recursive: true, force: true });
  });

  it("builds deterministic public artifact manifests", () => {
    const first = buildArtifactManifest([
      { kind: "result-artifact", hash: "sha256:b", role: "result" },
      { kind: "question-body", hash: "sha256:a", role: "body" }
    ]);
    const second = buildArtifactManifest([
      { kind: "question-body", hash: "sha256:a", role: "body" },
      { kind: "result-artifact", hash: "sha256:b", role: "result" }
    ]);

    expect(first).toEqual(second);
    expect(hashArtifactManifest(first.references)).toEqual(hashArtifactManifest(second.references));
    expect(first).toMatchObject({
      protocol: "popular-consensus",
      schemaVersion: "artifact-manifest-v1"
    });
  });

  it("adds stable schema labels to stored artifact payloads", () => {
    const artifact = withArtifactSchema("discussion-post", {
      questionId: "question-1",
      kind: "Comment",
      body: "Public note"
    });

    expect(artifact).toEqual({
      artifactKind: "discussion-post",
      schemaVersion: "pc-discussion-post-v1",
      questionId: "question-1",
      kind: "Comment",
      body: "Public note"
    });
    expect(schemaVersionForArtifactKind("question-archive")).toBe("pc-question-archive-v1");
  });

  it("verifies stored artifact hashes and manifest references", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "pc-artifacts-"));
    const body = await writeArtifact(dir, withArtifactSchema("question-body", { title: "Question", body: "Body" }));
    const result = await writeArtifact(dir, withArtifactSchema("result-artifact", { pollId: "poll-1", turnout: 10 }));

    const bodyVerification = await verifyStoredArtifact(dir, body.hash);
    expect(bodyVerification).toMatchObject({ hash: body.hash, computedHash: body.hash, valid: true });

    const manifest = buildArtifactManifest([
      { kind: "result-artifact", hash: result.hash, role: "result" },
      { kind: "question-body", hash: body.hash, role: "body" }
    ]);
    const manifestVerification = await verifyArtifactManifest(dir, manifest);
    expect(manifestVerification.valid).toBe(true);
    expect(manifestVerification.manifestHash).toBe(hashArtifactManifest(manifest.references));
    expect(manifestVerification.references.map((reference) => reference.valid)).toEqual([true, true]);

    await writeFile(body.path, `${JSON.stringify({ title: "Question", body: "Tampered" }, null, 2)}\n`, "utf8");
    const tamperedManifestVerification = await verifyArtifactManifest(dir, manifest);
    expect(tamperedManifestVerification.valid).toBe(false);
    expect(tamperedManifestVerification.references.find((reference) => reference.hash === body.hash)?.computedHash).not.toBe(body.hash);

    await rm(dir, { recursive: true, force: true });
  });

  it("builds portable export bundles from verified manifest references", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "pc-artifacts-"));
    const archive = await writeArtifact(dir, withArtifactSchema("question-archive", { questionId: "question-1" }));
    const body = await writeArtifact(dir, withArtifactSchema("question-body", { title: "Question", body: "Body" }));
    const discussion = await writeArtifact(dir, withArtifactSchema("discussion-post", { questionId: "question-1", kind: "Comment", body: "Note" }));
    const manifest = buildArtifactManifest([
      { kind: "discussion-post", hash: discussion.hash, role: "discussion" },
      { kind: "question-body", hash: body.hash, role: "body" }
    ]);

    const bundle = await buildArtifactExportBundle(dir, manifest, { kind: "question-archive", hash: archive.hash, role: "archive" });

    expect(bundle).toMatchObject({
      protocol: "popular-consensus",
      schemaVersion: "artifact-export-bundle-v1",
      manifestHash: hashArtifactManifest(manifest.references),
      root: { kind: "question-archive", hash: archive.hash, computedHash: archive.hash },
      artifacts: [
        { kind: "question-body", hash: body.hash, computedHash: body.hash },
        { kind: "discussion-post", hash: discussion.hash, computedHash: discussion.hash }
      ]
    });
    expect(bundle.root).not.toHaveProperty("path");
    expect(bundle.artifacts[0]).not.toHaveProperty("path");

    await rm(dir, { recursive: true, force: true });
  });

  it("exposes file storage through the artifact storage adapter boundary", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "pc-artifacts-"));
    const storage = createFileArtifactStorage(dir);
    const body = await storage.write(withArtifactSchema("question-body", { title: "Question", body: "Body" }));
    const manifest = buildArtifactManifest([{ kind: "question-body", hash: body.hash, role: "body" }]);

    expect(await storage.read(body.hash)).toEqual(body.value);
    expect(await storage.verify(body.hash)).toMatchObject({ valid: true, computedHash: body.hash });
    expect(await storage.buildExportBundle(manifest)).toMatchObject({
      schemaVersion: "artifact-export-bundle-v1",
      artifacts: [{ kind: "question-body", hash: body.hash, computedHash: body.hash }]
    });

    await rm(dir, { recursive: true, force: true });
  });
});
