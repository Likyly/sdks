<?php

use Illuminate\Support\Facades\Route;
use Likyly\Laravel\Http\ClickController;

Route::middleware('web')->get(config('likyly.click_path', 'likyly/click'), ClickController::class)->name('likyly.click');
