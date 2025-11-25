/*
 * Copyright (c) 2025 Naval Group
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 */

/**
 * ************************************************************************************
 * *******************************   PROCESS & INSTANCE MODULE   ************************
 * ************************************************************************************
 *
 * NOTE: This module is under active development.
 * 
 * Provides classes to represent and manage system processes and LOTUSIM simulation instances.
 *
 * Features:
 * - `Process` class:
 *   - Represents a single system process with a name and PID (process identifier).
 *
 * - `Instance` class:
 *   - Represents a simulation instance with a name and associated processes.
 *   - Methods to add or remove processes dynamically.
 *
 * Notes:
 * - This module is primarily used for managing LOTUSIM simulation instances.
 * - Currently no system-level process management beyond the in-memory representation.
 * 
 */

export class Process {
    name: string;
    pid: number;

    constructor(name: string, pid: number) {
        this.name = name;
        this.pid = pid;
    }
}

export class Instance {
    name: string;
    processes: Process[];

    constructor(name: string, processes: Process[]) {
        this.name = name;
        this.processes = processes;
    }

    addProcess(process: Process) {
        this.processes.push(process);
    }

    deleteProcess(name: string) {
        this.processes = this.processes.filter(process => process.name !== name);
    }
}