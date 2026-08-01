<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('material_sizes', function (Blueprint $table) {
            $table->decimal('rate_per_month', 12, 2)->nullable()->after('label');
            $table->decimal('rate_per_day', 12, 6)->nullable()->after('rate_per_month');
            $table->string('unit', 16)->default('Nos')->after('rate_per_day');
        });

        Schema::create('quotation_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quotation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('material_id')->constrained();
            $table->foreignId('material_size_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('rate_per_month', 12, 2)->nullable();
            $table->timestamps();
        });

        Schema::create('indent_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('indent_id')->constrained()->cascadeOnDelete();
            $table->foreignId('material_id')->constrained();
            $table->foreignId('material_size_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->timestamps();
        });

        Schema::create('site_transfer_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('site_transfer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('material_id')->constrained();
            $table->foreignId('material_size_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->timestamps();
        });

        Schema::create('stock_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->foreignId('material_id')->constrained();
            $table->foreignId('material_size_id')->nullable()->constrained()->nullOnDelete();
            $table->integer('quantity')->default(0);
            $table->timestamps();

            $table->unique(['location_id', 'material_id', 'material_size_id'], 'stock_balances_unique');
        });

        Schema::create('rental_bills', function (Blueprint $table) {
            $table->id();
            $table->string('bill_no')->unique();
            $table->foreignId('location_id')->constrained();
            $table->string('site_name');
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('centering_total', 14, 2)->default(0);
            $table->decimal('scaffolding_total', 14, 2)->default(0);
            $table->decimal('grand_total', 14, 2)->default(0);
            $table->enum('status', ['draft', 'raised', 'synced'])->default('draft');
            $table->foreignId('generated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('raised_at')->nullable();
            $table->timestamps();
        });

        Schema::create('rental_bill_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rental_bill_id')->constrained()->cascadeOnDelete();
            $table->foreignId('material_id')->constrained();
            $table->foreignId('material_size_id')->nullable()->constrained()->nullOnDelete();
            $table->string('particulars');
            $table->string('category_group')->default('centering'); // centering | scaffolding
            $table->string('unit', 16)->default('Nos');
            $table->unsignedInteger('quantity')->default(0);
            $table->date('start_date');
            $table->date('end_date');
            $table->unsignedInteger('days')->default(0);
            $table->unsignedInteger('total_consumed')->default(0);
            $table->decimal('rate_per_month', 12, 2)->default(0);
            $table->decimal('rate_per_day', 12, 6)->default(0);
            $table->decimal('amount', 14, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type'); // billing_reminder | return_due
            $table->string('title');
            $table->text('body')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });

        Schema::table('material_movements', function (Blueprint $table) {
            $table->date('due_date')->nullable()->after('completed_at');
            $table->string('linked_dc_number')->nullable()->after('grn_number');
        });
    }

    public function down(): void
    {
        Schema::table('material_movements', function (Blueprint $table) {
            $table->dropColumn(['due_date', 'linked_dc_number']);
        });

        Schema::dropIfExists('notifications');
        Schema::dropIfExists('rental_bill_lines');
        Schema::dropIfExists('rental_bills');
        Schema::dropIfExists('stock_balances');
        Schema::dropIfExists('site_transfer_items');
        Schema::dropIfExists('indent_items');
        Schema::dropIfExists('quotation_items');

        Schema::table('material_sizes', function (Blueprint $table) {
            $table->dropColumn(['rate_per_month', 'rate_per_day', 'unit']);
        });
    }
};
