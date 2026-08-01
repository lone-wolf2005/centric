<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Material;
use Illuminate\Http\JsonResponse;

class MaterialController extends Controller
{
    public function index(): JsonResponse
    {
        $materials = Material::query()
            ->where('is_active', true)
            ->with('sizes')
            ->orderBy('name')
            ->get();

        return response()->json($materials);
    }
}
