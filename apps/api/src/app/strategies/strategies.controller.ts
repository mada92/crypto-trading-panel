import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StrategiesService } from './strategies.service';
import { CreateStrategyDto, UpdateStrategyDto } from './dto/strategy.dto';

@Controller('strategies')
export class StrategiesController {
  constructor(private readonly strategiesService: StrategiesService) {}

  @Get()
  async findAll(@Query('status') status?: string) {
    return this.strategiesService.findAll(status);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.strategiesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createStrategyDto: CreateStrategyDto) {
    return this.strategiesService.create(createStrategyDto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateStrategyDto: UpdateStrategyDto
  ) {
    return this.strategiesService.update(id, updateStrategyDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.strategiesService.remove(id);
  }

  @Post(':id/clone')
  async clone(@Param('id') id: string) {
    return this.strategiesService.clone(id);
  }

  @Get(':id/versions')
  async getVersions(@Param('id') id: string) {
    return this.strategiesService.getVersions(id);
  }

  @Post('validate')
  async validate(@Body() schema: unknown) {
    return this.strategiesService.validate(schema);
  }
}
