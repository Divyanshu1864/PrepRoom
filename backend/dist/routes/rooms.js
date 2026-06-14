"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const roomsController = __importStar(require("../controllers/rooms"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// POST /api/rooms - Create a room
router.post("/", auth_1.requireAuth, roomsController.create);
// GET /api/rooms - List all user's rooms
router.get("/", auth_1.requireAuth, roomsController.list);
// GET /api/rooms/:roomId - Get single room details
router.get("/:roomId", auth_1.requireAuth, roomsController.getDetails);
// POST /api/rooms/:roomId/join - Join a room
router.post("/:roomId/join", auth_1.requireAuth, roomsController.join);
// DELETE /api/rooms/:roomId - Delete a room (only for the owner)
router.delete("/:roomId", auth_1.requireAuth, roomsController.deleteRoom);
exports.default = router;
