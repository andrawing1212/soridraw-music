export type Stage416Environment = 'preview'|'test'|'production';

export type Stage416EnvironmentConfig = {
  environment:Stage416Environment;
  batchRoot:string;
  timingPath:string;
  taskTarget:string;
  workerEndpoint:string;
};

export const STAGE416_ENVIRONMENTS:Record<Stage416Environment,Stage416EnvironmentConfig>={
 preview:{
  environment:'preview',
  batchRoot:'privateLikeBatch416',
  timingPath:'likeBatchTiming416/current',
  taskTarget:'stage416SettlePrivateWindowCandidate',
  workerEndpoint:'https://soridraw-explore-preview.andrawing1212.workers.dev/v1/internal/private-like-handoff-416',
 },
 test:{
  environment:'test',
  batchRoot:'privateLikeBatch416Test',
  timingPath:'likeBatchTiming416/test/current',
  taskTarget:'stage416SettlePrivateWindowTest416',
  workerEndpoint:'https://soridraw-explore-test.andrawing1212.workers.dev/v1/internal/private-like-handoff-416',
 },
 production:{
  environment:'production',
  batchRoot:'privateLikeBatch416Production',
  timingPath:'likeBatchTiming416/production/current',
  taskTarget:'stage416SettlePrivateWindowProduction416',
  workerEndpoint:'https://soridraw-explore-api.andrawing1212.workers.dev/v1/internal/private-like-handoff-416',
 },
};
