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
 * *******************************   WEBSOCKET SERVER MODULE   ************************
 * ************************************************************************************
 *
 * Provides a WebSocket server for real-time vessel position updates.
 *
 * Features:
 * - Handles client connections and disconnections.
 * - Identifies clients based on `instance` sent during connection.
 * - Periodically broadcasts vessel position data to each connected client.
 * - Each client receives only the vessels associated with its instance.
 *
 */


import WebSocket from 'ws';
import { rosInstances } from './ros';
import { GeoPoint, } from './geometry';
import http from 'http';

/**
 * WebSocketServer class for handling real-time vessel position updates.
 * 
 * This server manages WebSocket connections and broadcasts vessel position data
 * to connected clients every 2 seconds.
 */
export class WebSocketServer {
    /**
     * The WebSocket server instance.
     */
    private wss: WebSocket.Server;

    /**
     * Maps each connected WebSocket client to a unique identifier (e.g., instance name).
     */
    private clientNameWsMapping: Map<string, WebSocket>;
    private wsClientNameMapping: Map<WebSocket, string>;

    /**
     * Creates a new WebSocket server.
     */
    constructor(
        server: http.Server,
    ) {
        this.wss = new WebSocket.Server({ server });
        this.clientNameWsMapping = new Map<string, WebSocket>();
        this.wsClientNameMapping = new Map<WebSocket, string>();
        console.log(`WebSocket server started.`);
    }

    /**
     * Starts the WebSocket server and sets up connection handling.
     * 
     * - Listens for new client connections.
     * - Handles incoming messages to identify clients.
     * - Manages client disconnection events.
     * - Broadcasts vessel position data every 2 seconds.
     *  
     * @param period: Period between broadcast of vessel position
     */
    public start(period: number): void {
        this.wss.on('connection', (ws: WebSocket) => {
            console.log('A new client connected.');

            ws.on('message', (data: WebSocket.Data) => {
                try {
                    const parsed = JSON.parse(data.toString());
                    const instanceName = parsed.instance;

                    if (typeof parsed.instance !== 'string') {
                        ws.send('Error: "instance" field must be a string.');
                        return;
                    }
                    else {
                        if (!this.clientNameWsMapping.get(instanceName)) {
                            console.log(`Client connected with instance: ${instanceName}`);
                            this.clientNameWsMapping.set(instanceName, ws);
                            this.wsClientNameMapping.set(ws, instanceName);
                        }
                    }

                } catch (error) {
                    console.error('Error parsing client message:', error);
                    ws.send('Error: Invalid JSON format.');
                }
            });

            // Handle client disconnection
            ws.on('close', () => {
                console.log('A client disconnected.');

                const clientName = this.wsClientNameMapping.get(ws);
                if (clientName) {
                    this.clientNameWsMapping.delete(clientName);
                    console.log('Reason for closure:', `${clientName} has left.`);
                } else {
                    console.log('Reason for closure: Unknown client disconnected.');
                }
                this.wsClientNameMapping.delete(ws);
            });

            // Handle connection errors
            ws.on('error', (err: Error) => {
                console.error('Client connection error:', err);
            });
        });

        // Periodically broadcast vessel data to all connected clients
        setInterval(() => this.broadcastVesselData(), period);
    }

    /**
     * Broadcasts vessel position data to all connected clients.
     * 
     * Each client receives position data for the vessels in the instance they are associated with.
     */
    private broadcastVesselData(): void {
        this.clientNameWsMapping.forEach((ws, clientName) => {
            const vesselMap = rosInstances.getInstanceVesselMap(clientName);

            if (vesselMap) {
                const jsonArray = Array.from(vesselMap.entries()).map(([vessel_name, position]) => ({
                    vessel_name: vessel_name,
                    pose: {
                        latitude: position.latitude,
                        longitude: position.longitude,
                        heading: position.heading
                    }
                }));
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(jsonArray, null, 2));
                } else {
                    console.log(`websocket close`);
                }
            }
            else {
                console.log(`No vessel data found for client: ${clientName}`);
            }

        });
    }
}
