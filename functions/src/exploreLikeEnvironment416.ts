export type Stage416Environment='preview'|'test'|'production';

export type Stage416EnvironmentConfig={
 environment:Stage416Environment;
 callableName:string;
 schedulerName:string;
 settleName:string;
 finalReceiptName:string;
 publicReleaseName:string;
 publicReleaseTaskName:string;
 taskTarget:string;
  privateRoot:string;
  globalVersionRoot:string;
 finalRoot:string;
 publicReleaseMarkerRoot:string;
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
  publicReleaseName:'publicLikeRelease416Candidate',
  publicReleaseTaskName:'stage416ReleasePublicWindowCandidate',
  taskTarget:'stage416SettlePrivateWindowCandidate',
  privateRoot:'privateLikeBatch416',finalRoot:'privateLikeFinal416',
  publicReleaseMarkerRoot:'publicLikeRelease416',
  globalVersionRoot:'privateLikeGlobalVersion416',
  timingPath:'likeBatchTiming416/current',
  workerEndpoint:'https://soridraw-explore-preview.andrawing1212.workers.dev/v1/internal/private-like-handoff-416',
 },
 test:{
  environment:'test',callableName:'recordPrivateLike416Test',
  schedulerName:'stage416SchedulePrivateWindowTest',settleName:'stage416SettlePrivateWindowTest',
  finalReceiptName:'privateLikeFinalReceipt416Test',
  publicReleaseName:'publicLikeRelease416Test',
  publicReleaseTaskName:'stage416ReleasePublicWindowTest',
  taskTarget:'stage416SettlePrivateWindowTest',
  privateRoot:'stage416Transient/test/privateLikeBatch',
  globalVersionRoot:'privateLikeGlobalVersion416',
  finalRoot:'stage416Transient/test/privateLikeFinal',
  publicReleaseMarkerRoot:'stage416Transient/test/publicLikeRelease',
  timingPath:'stage416Transient/test/likeBatchTiming/current',
  workerEndpoint:'https://soridraw-explore-test.andrawing1212.workers.dev/v1/internal/private-like-handoff-416',
 },
 production:{
  environment:'production',callableName:'recordPrivateLike416Production',
  schedulerName:'stage416SchedulePrivateWindowProduction',settleName:'stage416SettlePrivateWindowProduction',
  finalReceiptName:'privateLikeFinalReceipt416Production',
  publicReleaseName:'publicLikeRelease416Production',
  publicReleaseTaskName:'stage416ReleasePublicWindowProduction',
  taskTarget:'stage416SettlePrivateWindowProduction',
  privateRoot:'stage416Transient/production/privateLikeBatch',
  globalVersionRoot:'privateLikeGlobalVersion416',
  finalRoot:'stage416Transient/production/privateLikeFinal',
  publicReleaseMarkerRoot:'stage416Transient/production/publicLikeRelease',
  timingPath:'stage416Transient/production/likeBatchTiming/current',
  workerEndpoint:'https://soridraw-explore-api.andrawing1212.workers.dev/v1/internal/private-like-handoff-416',
 },
};
