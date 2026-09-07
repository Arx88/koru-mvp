/**
 * SavedRecordInterior — router del block `saved_record` según su data REAL:
 * - 1 record → SavedInterior (comprobante "Ya quedó en tu agenda", #p-saved)
 *   — es lo que emite el personal_capture de la app al guardar algo.
 * - N records → VaultInterior (bóveda/collection, #p-vault).
 * El routing es por shape del block (data-driven), no por hint externo.
 */
import type { UiBlock } from "../../../../domain/types";
import type { LecturaInteriorProps } from "../index";
import { SavedInterior } from "./SavedInterior";
import { VaultInterior } from "./VaultInterior";

type SavedRecordBlock = Extract<UiBlock, { type: "saved_record" }>;

export function SavedRecordInterior(props: LecturaInteriorProps<SavedRecordBlock>) {
  const many = (props.block.records?.length ?? 0) > 1;
  return many ? <VaultInterior {...props} /> : <SavedInterior {...props} />;
}
