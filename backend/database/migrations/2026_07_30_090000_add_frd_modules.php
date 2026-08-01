<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('type', ['godown', 'client_site', 'project_site'])->default('godown');
            $table->string('address')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('quotations', function (Blueprint $table) {
            $table->id();
            $table->string('quote_no')->unique();
            $table->unsignedTinyInteger('revision')->default(1);
            $table->string('customer_name');
            $table->string('site_name')->nullable();
            $table->enum('status', ['draft', 'sent', 'confirmed', 'revised', 'cancelled'])->default('draft');
            $table->decimal('estimated_amount', 12, 2)->nullable();
            $table->date('valid_until')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });

        Schema::create('indents', function (Blueprint $table) {
            $table->id();
            $table->string('indent_no')->unique();
            $table->string('project_name');
            $table->string('site_name')->nullable();
            $table->enum('status', ['open', 'in_progress', 'completed', 'cancelled'])->default('open');
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });

        Schema::table('material_movements', function (Blueprint $table) {
            $table->foreignId('quotation_id')->nullable()->after('tally_order_id')->constrained()->nullOnDelete();
            $table->foreignId('indent_id')->nullable()->after('quotation_id')->constrained()->nullOnDelete();
            $table->foreignId('source_location_id')->nullable()->after('destination')->constrained('locations')->nullOnDelete();
            $table->foreignId('destination_location_id')->nullable()->after('source_location_id')->constrained('locations')->nullOnDelete();
            $table->enum('return_condition', ['normal', 'damaged', 'scrap', 'repairable'])->nullable()->after('status');
            $table->enum('approval_status', ['pending', 'approved', 'rejected'])->default('pending')->after('return_condition');
            $table->foreignId('receiver_confirmed_by')->nullable()->after('approval_status')->constrained('users')->nullOnDelete();
            $table->timestamp('receiver_confirmed_at')->nullable()->after('receiver_confirmed_by');
        });

        Schema::create('site_transfers', function (Blueprint $table) {
            $table->id();
            $table->string('transfer_no')->unique();
            $table->foreignId('from_location_id')->constrained('locations');
            $table->foreignId('to_location_id')->constrained('locations');
            $table->enum('status', ['pending', 'in_transit', 'completed', 'cancelled'])->default('pending');
            $table->enum('sender_approval', ['pending', 'approved', 'rejected'])->default('pending');
            $table->enum('receiver_approval', ['pending', 'approved', 'rejected'])->default('pending');
            $table->enum('authority_approval', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('created_by')->constrained('users');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('approvals', function (Blueprint $table) {
            $table->id();
            $table->string('approvable_type');
            $table->unsignedBigInteger('approvable_id');
            $table->enum('type', ['delivery', 'return', 'transfer', 'override'])->default('delivery');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('requested_by')->constrained('users');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamp('acted_at')->nullable();
            $table->timestamps();

            $table->index(['approvable_type', 'approvable_id']);
        });

        Schema::table('scan_events', function (Blueprint $table) {
            $table->foreignId('expected_size_id')->nullable()->after('detected_material_id')->constrained('material_sizes')->nullOnDelete();
            $table->boolean('size_mismatch')->default(false)->after('is_match');
            $table->string('action_taken')->nullable()->after('feedback');
        });
    }

    public function down(): void
    {
        Schema::table('scan_events', function (Blueprint $table) {
            $table->dropConstrainedForeignId('expected_size_id');
            $table->dropColumn(['size_mismatch', 'action_taken']);
        });

        Schema::dropIfExists('approvals');
        Schema::dropIfExists('site_transfers');

        Schema::table('material_movements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('quotation_id');
            $table->dropConstrainedForeignId('indent_id');
            $table->dropConstrainedForeignId('source_location_id');
            $table->dropConstrainedForeignId('destination_location_id');
            $table->dropConstrainedForeignId('receiver_confirmed_by');
            $table->dropColumn([
                'return_condition',
                'approval_status',
                'receiver_confirmed_at',
            ]);
        });

        Schema::dropIfExists('indents');
        Schema::dropIfExists('quotations');
        Schema::dropIfExists('locations');
    }
};
