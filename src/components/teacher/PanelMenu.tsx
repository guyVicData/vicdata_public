// 0.8 shell (docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md, Part A): moved to
// src/components/shell/PanelMenu.tsx, shared by Teacher, Admissions and SMT. Re-exported here so
// nothing that imports the old path has to change.
export {
  useDismiss,
  PanelMenu,
  MenuHeading,
  MenuDivider,
  MenuCardRow,
  MenuRow,
} from "@/components/shell/PanelMenu";
