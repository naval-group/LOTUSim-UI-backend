/*
 * Copyright (c) 2025 Naval Group
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 */
import { App } from './app';
import { WebSocketServer } from './interfaces/websocket';
import http from 'http';
import * as rclnodejs from 'rclnodejs';
import { rosInstances } from './interfaces/ros';

(async () => {
    if (rclnodejs.isShutdown()) {
        await rclnodejs.init();
    }
    const appInstance = new App();

    const server = http.createServer(appInstance.getExpressApp());

    const period = 2000;
    const wss = new WebSocketServer(server);
    wss.start(period);

    const PORT = 5000;
    server.listen(PORT, () => {
        console.log(`Express & WebSocket server running on http://localhost:${PORT}`);
    });

    // TODO: Temp fix. Only one instance of lotusim for now
    rosInstances.addInstance("lotusim");

    const shutdownHandler = async (signal: string) => {
        console.log(`\nReceived ${signal}. Stopping server and ROS node...`);
        try {
            await rclnodejs.shutdown();
            process.exit(0);
        } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    };

    ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
        process.on(signal, () => shutdownHandler(signal));
    });
})();
