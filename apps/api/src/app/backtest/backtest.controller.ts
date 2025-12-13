import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { BacktestService } from './backtest.service';
import { RunBacktestDto } from './dto/backtest.dto';

@Controller('backtests')
export class BacktestController {
  constructor(private readonly backtestService: BacktestService) {}

  @Get()
  async findAll(
    @Query('strategyId') strategyId?: string,
    @Query('status') status?: string
  ) {
    return this.backtestService.findAll(strategyId, status);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.backtestService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async run(@Body() runBacktestDto: RunBacktestDto) {
    return this.backtestService.run(runBacktestDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.backtestService.remove(id);
  }

  @Get(':id/trades')
  async getTrades(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.backtestService.getTrades(
      id,
      parseInt(page || '1'),
      parseInt(limit || '50')
    );
  }

  @Get(':id/equity')
  async getEquityCurve(@Param('id') id: string) {
    return this.backtestService.getEquityCurve(id);
  }

  @Get(':id/metrics')
  async getMetrics(@Param('id') id: string) {
    return this.backtestService.getMetrics(id);
  }

  @Sse(':id/progress')
  subscribeToProgress(@Param('id') id: string): Observable<MessageEvent> {
    return this.backtestService.subscribeToProgress(id);
  }
}

interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}
