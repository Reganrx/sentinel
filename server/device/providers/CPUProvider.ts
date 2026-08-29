import os from "os";

import {
  DEVICE_PROVIDER_PRIORITY,
} from "../config.js";

import {
  updateCPUState,
} from "../deviceState.js";

import type {
  CPUState,
} from "../deviceTypes.js";

import {
  DeviceProvider,
} from "./DeviceProvider.js";

export class CPUProvider implements DeviceProvider {

  readonly name = "cpu";

  readonly priority = DEVICE_PROVIDER_PRIORITY.CPU;

  private previousSnapshot = os.cpus();

  async refresh(): Promise<void> {

    const cpus = os.cpus();

    const cpu: CPUState = {

      model: cpus[0]?.model ?? "",

      cores: cpus.length,

      threads: cpus.length,

      usage: this.calculateUsage(
        this.previousSnapshot,
        cpus
      ),

      speed: cpus[0]?.speed ?? 0,

      loadAverage: os.loadavg(),

    };

    this.previousSnapshot = cpus;

    updateCPUState(
      cpu
    );

  }

  private calculateUsage(
    previous: os.CpuInfo[],
    current: os.CpuInfo[]
  ): number {

    let idle = 0;

    let total = 0;

    for (
      let i = 0;
      i < current.length;
      i++
    ) {

      const previousTimes = previous[i].times;

      const currentTimes = current[i].times;

      const idleDelta =
        currentTimes.idle -
        previousTimes.idle;

      const totalDelta =
        (
          currentTimes.user +
          currentTimes.nice +
          currentTimes.sys +
          currentTimes.idle +
          currentTimes.irq
        ) -
        (
          previousTimes.user +
          previousTimes.nice +
          previousTimes.sys +
          previousTimes.idle +
          previousTimes.irq
        );

      idle += idleDelta;

      total += totalDelta;

    }

    if (
      total === 0
    ) {

      return 0;

    }

    return Math.round(
      (
        1 -
        idle / total
      ) * 100
    );

  }

}