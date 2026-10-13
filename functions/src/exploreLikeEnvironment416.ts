export type Stage416Environment='preview'|'test'|'production';

export type Stage416EnvironmentConfig={
 environment:Stage416Environment;
 callableName:string;
 schedulerName:string;
 settleName:string;
 finalReceiptName:string;
 taskTarget:string;
 privateRoot:string;
 finalRoot:string;
 timingPath:string;
 workerEndpoint:string;
};

// Canonical likes remain shared. Only short-lived batching state and runtime
// identities are environment scoped. PREVIEW deliberately retains every
// legacy identity/path used by the controlled proof.
export const STAGE416_ENVIRONMENTS:Record<Stage416Environment,Stage416EnvironmentConfig>={
 preview:{
  environment:'preview',callableName:'recordPrivateLike416',
  schedulerName:'stage416SchedulePrivateWindowCandidate',
  settleName:'stage416SettlePrivateWindowCandidate',
  finalReceiptName:'privateLikeFinalReceipt416Candidate',
  taskTarget:'stage416SettlePrivateWindowCandidate',
  privateRoot:'privateLikeBatch416',finalRoot:'privateLikeFinal416',
  timingPath:'likeBatchTiming416/current',
  workerEndpoint:'https://soridraw-explore-preview.andrawing1212.workers.dev/v1/internal/private-like-handoff-416',
 },
 test:{
  environment:'test',callableName:'recordPrivateLike416Test',
  schedulerName:'stage416SchedulePrivateWindowTest',settleName:'stage416SettlePrivateWindowTest',
  finalReceiptName:'privateLikeFinalReceipt416Test',taskTarget:'stage416SettlePrivateWindowTest',
  privateRoot:'stage416Transient/test/privateLikeBatch',
  finalRoot:'stage416Transient/test/privateLikeFinal',
  timingPath:'stage416Transient/test/likeBatchTiming/current',
  workerEndpoint:'https://soridraw-explore-test.andrawing1212.workers.dev/v1/internal/private-like-handoff-416',
 },
 production:{
  environment:'production',callableName:'recordPrivateLike416Production',
  schedulerName:'stage416SchedulePrivateWindowProduction',settleName:'stage416SettlePrivateWindowProduction',
  finalReceiptName:'privateLikeFinalReceipt416Production',taskTarget:'stage416SettlePrivateWindowProduction',
  privateRoot:'stage416Transient/production/privateLikeBatch',
  finalRoot:'stage416Transient/production/privateLikeFinal',
  timingPath:'stage416Transient/production/likeBatchTiming/current',
  workerEndpoint:'https://soridraw-explore-api.andrawing1212.workers.dev/v1/internal/private-like-handoff-416',
 },
};
