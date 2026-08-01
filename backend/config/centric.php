<?php

return [
    'ai_service_url' => env('AI_SERVICE_URL', 'http://127.0.0.1:5001'),

    'yolo_to_material_code' => [
        'adjust' => 'ADJUSTMENT_SHEET',
        'aluminium' => 'ALUMINIUM_CHANNEL',
        'MS_Channel' => 'ALUMINIUM_CHANNEL',
        'Angle_Shutter_Frame' => 'ANGLE_SHUTTER_FRAME',
        'C_ledger_all' => 'CUPLOCK_UNITS',
        'C_vertical_all' => 'CUPLOCK_UNITS',
        'V_Ledger' => 'CUPLOCK_UNITS',
        'Nandu_Clamp' => 'CUPLOCK_UNITS',
        'H_Pipe_All' => 'H_PIPE_UNITS',
        'Lift_side_pipe' => 'LIFT_UNITS',
        'Props' => 'ADJUSTABLE_PROPS',
        'Screw_Jacky' => 'ADJUSTABLE_PROPS',
        'Sheet' => 'CENTERING_SHEET',
        'Span' => 'ADJUSTABLE_SPAN',
        'Platform_Grill' => 'DECK_UNITS',
        'Base_Plate' => 'STAGING_UNITS',
        'Bracing_Pipe' => 'STAGING_UNITS',
        'Gribs' => 'STAGING_UNITS',
    ],
];
