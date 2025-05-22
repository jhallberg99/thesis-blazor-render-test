import { readdirSync, readFileSync, writeFileSync } from 'fs';
 
 
const renderModes = readdirSync('./TestResults', { withFileTypes: true });
 
for (const renderMode of renderModes) {
  if (renderMode.isDirectory()) {
    const networkConfigs = readdirSync( './TestResults' + `/${renderMode.name}`, { withFileTypes: true });
 
    for  (const networkConfig of networkConfigs) {
      const averageResult = {
        testedRenderMode: renderMode.name,
        avgCPUBenchmarkIndex: 0,
        throttling: {},  
        initial_load_metrics: {
          avgFcpMs: 0,
          avgLcpMs: 0,
          avgSiMs: 0,
          avgTbtMs: 0,
          avgCls: 0,
        },
        user_interaction_metrics: {
          avgTtbMs: 0,
          avgInpMs: 0,
          avgCls: 0,
 
        },
        second_load_metrics: {
          avgFcpMs: 0,
          avgLcpMs: 0,
        },
        eventToDomUpdateTimings: {
          avgSortingMs: 0,
          avgExpandCollapsMs: 0,
          avgFilteringMs: 0,
          avgDbFetchMs: 0,
        }
      };
 
      if (networkConfig.isDirectory()) {
        const resultJsonFiles = readdirSync('./TestResults' + `/${renderMode.name}` + `/${networkConfig.name}`, { withFileTypes: true });
 
        for (const [resultIndex, resultJsonFile] of resultJsonFiles.entries()) {
 
          if (resultJsonFile.isFile() && resultJsonFile.name.endsWith('.json')) {
            const jsonData = JSON.parse(readFileSync('./TestResults' + `/${renderMode.name}` + `/${networkConfig.name}`+ `/${resultJsonFile.name}`, 'utf-8'));
 
            if (resultIndex === 1) {
              averageResult.throttling = jsonData.throttling;
            }
 
            averageResult.avgCPUBenchmarkIndex += jsonData.avgCPUBenchmarkIndex;
 
            averageResult.initial_load_metrics.avgFcpMs += jsonData.initial_load_metrics["first-contentful-paint"].numericValue;
            averageResult.initial_load_metrics.avgLcpMs += jsonData.initial_load_metrics["largest-contentful-paint"].numericValue;
            averageResult.initial_load_metrics.avgSiMs += jsonData.initial_load_metrics["speed-index"].numericValue;
            averageResult.initial_load_metrics.avgTbtMs += jsonData.initial_load_metrics["total-blocking-time"].numericValue;
            averageResult.initial_load_metrics.avgCls += jsonData.initial_load_metrics["cumulative-layout-shift"].numericValue;
 
            averageResult.user_interaction_metrics.avgTtbMs += jsonData.user_interaction_metrics["total-blocking-time"].numericValue;
            averageResult.user_interaction_metrics.avgInpMs += jsonData.user_interaction_metrics["interaction-to-next-paint"].numericValue;
            averageResult.user_interaction_metrics.avgCls += jsonData.user_interaction_metrics["cumulative-layout-shift"].numericValue;
 
            averageResult.second_load_metrics.avgFcpMs += jsonData.second_load_metrics["first-contentful-paint"].numericValue;
            averageResult.second_load_metrics.avgLcpMs += jsonData.second_load_metrics["largest-contentful-paint"].numericValue;
 
            averageResult.eventToDomUpdateTimings.avgSortingMs += avgOfTimingsArray(jsonData.eventToDomUpdate_interactions.sorting);
            averageResult.eventToDomUpdateTimings.avgExpandCollapsMs += avgOfTimingsArray(jsonData.eventToDomUpdate_interactions.expandCollaps);
            averageResult.eventToDomUpdateTimings.avgFilteringMs += avgOfTimingsArray(jsonData.eventToDomUpdate_interactions.filtering);
            averageResult.eventToDomUpdateTimings.avgDbFetchMs += avgOfTimingsArray(jsonData.eventToDomUpdate_interactions.dbFetch);
          }
        }
 
        averageResult.avgCPUBenchmarkIndex /= 10;
 
        averageResult.initial_load_metrics.avgFcpMs /= 10;
        averageResult.initial_load_metrics.avgLcpMs /= 10;
        averageResult.initial_load_metrics.avgSiMs /= 10;
        averageResult.initial_load_metrics.avgTbtMs /= 10;
        averageResult.initial_load_metrics.avgCls /= 10;
 
        averageResult.user_interaction_metrics.avgTtbMs /= 10;
        averageResult.user_interaction_metrics.avgInpMs /= 10;
        averageResult.user_interaction_metrics.avgCls /= 10;
 
        averageResult.second_load_metrics.avgFcpMs /= 10;
        averageResult.second_load_metrics.avgLcpMs /= 10;
 
        averageResult.eventToDomUpdateTimings.avgSortingMs /= 10;
        averageResult.eventToDomUpdateTimings.avgExpandCollapsMs /= 10;
        averageResult.eventToDomUpdateTimings.avgFilteringMs /= 10;
        averageResult.eventToDomUpdateTimings.avgDbFetchMs /= 10;
 
        writeFileSync('./TestResults' + `/${renderMode.name}` + `/${networkConfig.name}` + '/averageResult.json', JSON.stringify(averageResult, null, 2));
      }
    }
  }
}
 
function avgOfTimingsArray(timingsArr){
  let sum = 0;
  timingsArr.forEach(element => {
    sum += element.duration;
  });
  return sum / timingsArr.length;
}