import { Server } from "socket.io";
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

interface ClientData {
    userId: string;
    IdEsp: number;
}

const port = process.env.WEBSOCKET_PORT || '3004';
const io = new Server(parseInt(port), {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT"]
    }
});

// Almacenar datos de usuarios por socket ID
const clientData: Record<string, ClientData> = {};

io.on("connection", (socket) => {
    console.log(`Nuevo cliente conectado: ${socket.id}`);

    socket.on("authenticate", (data) => {
        const token = data.token;
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || '12345');
                if (typeof decoded === 'object' && 'id' in decoded && 'IdEsp' in decoded) {
                    clientData[socket.id] = { userId: decoded.id, IdEsp: Number(decoded.IdEsp) };
                    console.log(`Datos almacenados para este socket después de autenticar [Socket ID: ${socket.id}]:`, clientData[socket.id]);
                    socket.emit("authenticated", { success: true, message: "Autenticación exitosa." });
                } else {
                    throw new Error("Invalid token structure");
                }
            } catch (error) {
                console.error(`Error al verificar el token desde ${socket.id}:`, error);
                socket.emit("auth_error", "Token inválido");
            }
        } else {
            console.log(`No se proporcionó token desde ${socket.id}`);
            socket.emit("auth_error", "No se proporcionó token");
        }
    });

    socket.on("sensorData", (sensorData) => {
        console.log(`Datos de sensor recibidos en ${socket.id}:`, sensorData);

      
        io.emit("updateSensorData", sensorData);

        // Adicionalmente, enviar datos al cliente específico que coincida con IdEsp
        Object.entries(clientData).forEach(([socketId, data]) => {
            if (data.IdEsp === sensorData.IdEsp) {
                console.log(`Enviando datos al cliente específico en socket ${socketId}`);
                io.to(socketId).emit("updateSensorDataSpecific", sensorData);
            }
        });
    });

    socket.on("disconnect", () => {
        console.log(`Cliente desconectado: ${socket.id}`);
        delete clientData[socket.id];
    });
});

console.log(`Servidor WebSocket escuchando en el puerto ${port}`);
