<?php

namespace Database\Seeders;

use App\Models\Indent;
use App\Models\IndentItem;
use App\Models\Location;
use App\Models\Material;
use App\Models\MaterialSize;
use App\Models\Quotation;
use App\Models\QuotationItem;
use App\Models\RentalBill;
use App\Models\RentalBillLine;
use App\Models\StockBalance;
use App\Models\User;
use App\Services\StockService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class CentricSeeder extends Seeder
{
    private const CENTERING_MATERIALS = [
        'Centering Sheet',
        'Adjustment Sheet',
        'Aluminium Channel',
        'Adjustable Props',
        'Adjustable Span',
    ];

    public function run(): void
    {
        $catalog = json_decode(
            file_get_contents(database_path('seeders/data/excel_catalog.json')),
            true,
            512,
            JSON_THROW_ON_ERROR
        );

        $supervisor = User::updateOrCreate(
            ['email' => 'supervisor@centric.local'],
            [
                'name' => 'Yard Supervisor',
                'password' => Hash::make('password'),
                'role' => 'supervisor',
            ]
        );

        User::updateOrCreate(
            ['email' => 'approver@centric.local'],
            [
                'name' => 'Site Approver',
                'password' => Hash::make('password'),
                'role' => 'approver',
            ]
        );

        $godown = Location::updateOrCreate(
            ['name' => 'Erode Godown'],
            ['type' => 'godown', 'address' => 'Sakthi Mahal, Erode', 'is_active' => true]
        );

        $siteLocations = [];
        foreach ($catalog['sites'] as $siteName) {
            $siteLocations[$siteName] = Location::updateOrCreate(
                ['name' => $siteName],
                ['type' => 'project_site', 'address' => $siteName, 'is_active' => true]
            );
        }

        $materialMap = [];
        $sizeMap = [];

        foreach ($catalog['materials'] as $materialName => $sizes) {
            $material = Material::updateOrCreate(
                ['code' => strtoupper(str_replace(' ', '_', $materialName))],
                ['name' => $materialName, 'is_active' => true]
            );
            $materialMap[$materialName] = $material;

            foreach ($sizes as $size) {
                $row = MaterialSize::updateOrCreate(
                    ['material_id' => $material->id, 'label' => $size['label']],
                    [
                        'rate_per_month' => $size['rate_per_month'],
                        'rate_per_day' => $size['rate_per_day'] ?? round($size['rate_per_month'] / 30, 6),
                        'unit' => $size['unit'] ?? 'Nos',
                    ]
                );
                $sizeMap[$materialName.'|'.$size['label']] = $row;
            }
        }

        $stock = app(StockService::class);
        foreach ($materialMap as $material) {
            foreach ($material->sizes as $size) {
                $stock->set($godown->id, $material->id, $size->id, 500);
            }
        }

        $quote = Quotation::updateOrCreate(
            ['quote_no' => 'QT-2026-001'],
            [
                'revision' => 1,
                'customer_name' => 'Sakthi Constructions',
                'site_name' => 'TNSCB Tiruttani',
                'status' => 'confirmed',
                'estimated_amount' => 250000,
                'valid_until' => now()->addMonths(1),
                'created_by' => $supervisor->id,
            ]
        );

        $sampleMaterial = $materialMap['Centering Sheet'] ?? reset($materialMap);
        $sampleSize = $sizeMap['Centering Sheet|4\' x 2\'']
            ?? $sizeMap['Centering Sheet|4\'x2\'']
            ?? $sampleMaterial->sizes()->first();

        if ($sampleSize) {
            QuotationItem::updateOrCreate(
                [
                    'quotation_id' => $quote->id,
                    'material_id' => $sampleMaterial->id,
                    'material_size_id' => $sampleSize->id,
                ],
                [
                    'quantity' => 100,
                    'rate_per_month' => $sampleSize->rate_per_month,
                ]
            );
        }

        $indent = Indent::updateOrCreate(
            ['indent_no' => 'IND-2026-008'],
            [
                'project_name' => 'RR Internal Bridge Project',
                'site_name' => 'MEPZ TFC Tambaram',
                'status' => 'open',
                'created_by' => $supervisor->id,
            ]
        );

        if ($sampleSize) {
            IndentItem::updateOrCreate(
                [
                    'indent_id' => $indent->id,
                    'material_id' => $sampleMaterial->id,
                    'material_size_id' => $sampleSize->id,
                ],
                ['quantity' => 50]
            );
        }

        $this->seedMayBills($catalog, $siteLocations, $materialMap, $sizeMap, $supervisor);

        unset($godown);
    }

    private function seedMayBills(
        array $catalog,
        array $siteLocations,
        array $materialMap,
        array $sizeMap,
        User $supervisor,
    ): void {
        $bySite = [];
        foreach ($catalog['usage_may_2026'] as $line) {
            $bySite[$line['site_name']][] = $line;
        }

        foreach ($bySite as $siteName => $lines) {
            $location = $siteLocations[$siteName] ?? null;
            if (! $location) {
                continue;
            }

            $bill = RentalBill::updateOrCreate(
                [
                    'location_id' => $location->id,
                    'period_start' => '2026-05-01',
                    'period_end' => '2026-05-31',
                ],
                [
                    'bill_no' => 'RB-202605-'.Str::upper(Str::substr(md5($siteName), 0, 6)),
                    'site_name' => $siteName,
                    'status' => 'raised',
                    'generated_by' => $supervisor->id,
                    'raised_at' => now(),
                ]
            );

            $bill->lines()->delete();

            $centering = 0.0;
            $scaffolding = 0.0;

            foreach ($lines as $line) {
                $material = $materialMap[$line['material']] ?? null;
                $size = $sizeMap[$line['material'].'|'.$line['size_label']] ?? null;
                if (! $material || ! $size) {
                    continue;
                }

                $start = Carbon::parse($line['start_date']);
                $end = Carbon::parse($line['end_date']);
                $days = max(0, $start->diffInDays($end));
                $qty = (int) $line['quantity'];
                $rateMonth = (float) ($line['rate_per_month'] ?? $size->rate_per_month);
                $rateDay = $rateMonth / 30;
                $consumed = $days * $qty;
                $amount = round($consumed * $rateDay, 2);
                $group = in_array($line['material'], self::CENTERING_MATERIALS, true)
                    ? 'centering'
                    : 'scaffolding';

                RentalBillLine::create([
                    'rental_bill_id' => $bill->id,
                    'material_id' => $material->id,
                    'material_size_id' => $size->id,
                    'particulars' => $line['size_label'],
                    'category_group' => $group,
                    'unit' => $size->unit ?? 'Nos',
                    'quantity' => $qty,
                    'start_date' => $start->toDateString(),
                    'end_date' => $end->toDateString(),
                    'days' => $days,
                    'total_consumed' => $consumed,
                    'rate_per_month' => $rateMonth,
                    'rate_per_day' => $rateDay,
                    'amount' => $amount,
                ]);

                if ($group === 'centering') {
                    $centering += $amount;
                } else {
                    $scaffolding += $amount;
                }

                StockBalance::updateOrCreate(
                    [
                        'location_id' => $location->id,
                        'material_id' => $material->id,
                        'material_size_id' => $size->id,
                    ],
                    ['quantity' => $qty]
                );
            }

            $bill->update([
                'centering_total' => round($centering, 2),
                'scaffolding_total' => round($scaffolding, 2),
                'grand_total' => round($centering + $scaffolding, 2),
            ]);
        }
    }
}
