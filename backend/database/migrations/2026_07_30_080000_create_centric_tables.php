<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('supervisor')->after('email');
        });

        Schema::create('materials', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('code', 32)->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('material_sizes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_id')->constrained()->cascadeOnDelete();
            $table->string('label');
            $table->timestamps();

            $table->unique(['material_id', 'label']);
        });

        Schema::create('tally_orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_no')->unique();
            $table->enum('type', ['rental', 'project'])->default('rental');
            $table->string('customer_name')->nullable();
            $table->string('site_name')->nullable();
            $table->enum('status', ['open', 'in_progress', 'completed', 'cancelled'])->default('open');
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();
        });

        Schema::create('material_movements', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['inward', 'outward']);
            $table->foreignId('tally_order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('dc_number')->nullable()->unique();
            $table->string('grn_number')->nullable()->unique();
            $table->foreignId('supervisor_id')->constrained('users');
            $table->string('destination')->nullable();
            $table->enum('status', ['draft', 'scanning', 'completed', 'cancelled'])->default('draft');
            $table->text('notes')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('movement_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_movement_id')->constrained()->cascadeOnDelete();
            $table->foreignId('material_id')->constrained();
            $table->foreignId('material_size_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('quantity')->default(0);
            $table->unsignedInteger('scanned_count')->default(0);
            $table->timestamps();
        });

        Schema::create('scan_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_movement_id')->constrained()->cascadeOnDelete();
            $table->foreignId('material_id')->constrained();
            $table->foreignId('material_size_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('status', ['active', 'paused', 'completed'])->default('active');
            $table->unsignedInteger('matched_count')->default(0);
            $table->unsignedInteger('mismatch_count')->default(0);
            $table->timestamps();
        });

        Schema::create('scan_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('scan_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('detected_material_id')->constrained('materials');
            $table->boolean('is_match')->default(false);
            $table->decimal('confidence', 5, 2)->nullable();
            $table->enum('feedback', ['match', 'mismatch'])->default('match');
            $table->boolean('manually_verified')->default(false);
            $table->timestamp('scanned_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scan_events');
        Schema::dropIfExists('scan_sessions');
        Schema::dropIfExists('movement_items');
        Schema::dropIfExists('material_movements');
        Schema::dropIfExists('tally_orders');
        Schema::dropIfExists('material_sizes');
        Schema::dropIfExists('materials');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }
};
