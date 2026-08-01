<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\FrdController;
use App\Http\Controllers\Api\MaterialController;
use App\Http\Controllers\Api\MovementController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\TallyOrderController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::get('/materials', [MaterialController::class, 'index']);
    Route::get('/locations', [FrdController::class, 'locations']);

    Route::get('/quotations', [FrdController::class, 'quotations']);
    Route::post('/quotations', [FrdController::class, 'storeQuotation']);
    Route::post('/quotations/{quotation}/revise', [FrdController::class, 'reviseQuotation']);

    Route::get('/indents', [FrdController::class, 'indents']);
    Route::post('/indents', [FrdController::class, 'storeIndent']);

    Route::get('/site-transfers', [FrdController::class, 'siteTransfers']);
    Route::post('/site-transfers', [FrdController::class, 'storeSiteTransfer']);
    Route::post('/site-transfers/{transfer}/approve', [FrdController::class, 'approveSiteTransfer']);

    Route::get('/approvals', [FrdController::class, 'approvals']);
    Route::post('/movements/{movement}/approve', [FrdController::class, 'approveMovement']);
    Route::get('/stock', [FrdController::class, 'stock']);
    Route::get('/scan-history', [FrdController::class, 'scanHistory']);

    Route::get('/tally-orders', [TallyOrderController::class, 'index']);
    Route::post('/tally-orders/sync', [TallyOrderController::class, 'sync']);

    Route::get('/movements', [MovementController::class, 'index']);
    Route::get('/movements/active-scan', [MovementController::class, 'activeScan']);
    Route::post('/movements', [MovementController::class, 'store']);
    Route::get('/movements/{movement}', [MovementController::class, 'show']);
    Route::post('/movements/{movement}/scan', [MovementController::class, 'startScan']);
    Route::post('/movements/{movement}/complete', [MovementController::class, 'complete']);

    Route::get('/scan-sessions/{session}', [MovementController::class, 'showScanSession']);
    Route::post('/scan-sessions/{session}/scan', [MovementController::class, 'recordScan']);
    Route::post('/scan-sessions/{session}/detect', [MovementController::class, 'detectFromImage']);
    Route::patch('/scan-sessions/{session}/expected-material', [MovementController::class, 'updateExpectedMaterial']);

    Route::get('/reports/dashboard', [ReportController::class, 'dashboard']);
    Route::get('/reports/inward', [ReportController::class, 'inward']);
    Route::get('/reports/outward', [ReportController::class, 'outward']);
    Route::get('/reports/item-summary', [ReportController::class, 'itemSummary']);
    Route::get('/reports/supervisor-summary', [ReportController::class, 'supervisorSummary']);
    Route::get('/reports/ai-accuracy', [ReportController::class, 'aiAccuracy']);
    Route::get('/reports/exceptions', [ReportController::class, 'exceptions']);
    Route::get('/reports/daily-activity', [ReportController::class, 'dailyActivity']);
    Route::get('/reports/pending-returns', [ReportController::class, 'pendingReturns']);
    Route::get('/reports/damage-scrap', [ReportController::class, 'damageScrap']);
    Route::get('/reports/billing-pending', [ReportController::class, 'billingPending']);
    Route::get('/reports/rental-status', [ReportController::class, 'rentalStatus']);
    Route::get('/reports/approval-status', [ReportController::class, 'approvalStatus']);
});
