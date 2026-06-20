import { describe, it, expect } from 'vitest';
import { calculateLineValues } from './ProductionRoutingForm';

describe('ProductionRoutingForm calculateLineValues', () => {
  it('uses base_observed_time when manpower changes', () => {
    const line = {
      machine_centre_id: '01',
      machine_name: 'Test machine',
      process: 'Test process',
      observed_time: '100',
      base_observed_time: '100',
      rating_factor: '100',
      normal_time_secs_pr: '',
      std_time_secs_pr: '',
      mins_6_prs_box: '',
      pairs_per_hr: '',
      pairs_per_day: '',
      manpower: '2',
    };

    const result = calculateLineValues(line);

    expect(result.observed_time).toBe(200);
    expect(result.manpower).toBe(2);
  });

  it('falls back to observed_time when base_observed_time is missing', () => {
    const line = {
      machine_centre_id: '01',
      machine_name: 'Test machine',
      process: 'Test process',
      observed_time: '100',
      base_observed_time: '',
      rating_factor: '100',
      normal_time_secs_pr: '',
      std_time_secs_pr: '',
      mins_6_prs_box: '',
      pairs_per_hr: '',
      pairs_per_day: '',
      manpower: '2',
    };

    const result = calculateLineValues(line);

    expect(result.observed_time).toBe(200);
    expect(result.manpower).toBe(2);
  });
});
